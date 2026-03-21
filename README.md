## Plugin License API

שרת API לניהול רישום פלאגינים ורשיונות, מבוסס Next.js (App Router) ו-PostgreSQL (Neon).

### התקנה מקומית

1. התקנת חבילות:
   ```bash
   npm install
   ```

2. הגדרת משתני סביבה:
   - צור קובץ `.env.local` על בסיס `.env.example`
   - הגדר:
     - `DATABASE_URL` - כתובת Neon (כולל sslmode=require)
     - `JWT_SECRET` - מחרוזת ארוכה ואקראית לחתימת JWT

3. הגדרת סכמת בסיס נתונים (Neon/Postgres):

  ```sql
  CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    api_key TEXT NOT NULL UNIQUE
  );

  CREATE TABLE plugins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL
  );

  CREATE TABLE licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    plugin_id UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    license_key TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NULL,
    allowed_activations INTEGER NULL
  );

  CREATE TABLE activations (
    id UUID PRIMARY KEY,
    license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    site_url TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX idx_licenses_lookup
    ON licenses (project_id, plugin_id, user_id);

  CREATE INDEX idx_activations_license_id
    ON activations (license_id);

  CREATE INDEX idx_activations_license_site_active
    ON activations (license_id, site_url, is_active);
  ```

  אם הטבלאות כבר קיימות אצלך, אפשר להריץ migration קצר:

  ```sql
  ALTER TABLE activations
    ADD COLUMN IF NOT EXISTS site_url TEXT;

  UPDATE activations
  SET site_url = 'unknown'
  WHERE site_url IS NULL;

  ALTER TABLE activations
    ALTER COLUMN site_url SET NOT NULL;

  ALTER TABLE activations
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

  CREATE INDEX IF NOT EXISTS idx_activations_license_site_active
    ON activations (license_id, site_url, is_active);
  ```

   לאחר מכן צור רשומת `project` ידנית עם `api_key` שתשמש אותך:

   ```sql
   INSERT INTO projects (name, api_key)
   VALUES ('default-project', 'YOUR_API_KEY_HERE');
   ```

### הפעלת שרת הפיתוח

```bash
npm run dev
```

### Endpoints

- **ללא טוקן**: `POST /api/token`, `POST /api/licenses/activate`, `POST /api/licenses/validate`
- **עם טוקן** (`Authorization: Bearer <JWT_TOKEN>`): `POST /api/plugins`, `POST /api/licenses/register`

```http
Authorization: Bearer <JWT_TOKEN>
```

#### 1. קבלת טוקן

- **POST** `/api/token`
- גוף:

  ```json
  { "apiKey": "YOUR_API_KEY_HERE" }
  ```

- תגובה:

  ```json
  { "token": "...", "expiresIn": 3600 }
  ```

#### 2. רישום מוצר חדש (פלאגין)

- **POST** `/api/plugins`
- גוף:

  ```json
  { "name": "My Plugin" }
  ```

- תגובה:

  ```json
  { "pluginId": "UUID" }
  ```

#### 3. רישום משתמש ורשיון חדש לפלאגין

- **POST** `/api/licenses/register`
- גוף:

  ```json
  {
    "userId": "user@example.com",
    "pluginId": "PLUGIN_UUID",
    "durationDays": 30,         // אופציונלי, אם לא נשלח – הרשיון ללא תפוגה
    "allowedActivations": 5     // אופציונלי, אם לא נשלח – כמות הפעלות לא מוגבלת
  }
  ```

- תגובה:

  ```json
  { "licenseKey": "UUID" }
  ```

#### 4. הפעלת רשיון (יצירת הפעלה)

- **POST** `/api/licenses/activate`
- גוף:

  ```json
  {
    "licenseKey": "LICENSE_KEY_UUID",
    "pluginId": "PLUGIN_UUID"
  }
  ```

- התנהגות:
  - הרשיון חייב להיות רשום ל־`pluginId` שצוין; אחרת תוחזר שגיאה 404.
  - `siteUrl` נגזר אוטומטית מהבקשה (`origin` או `referer`) ולא נשלח מהלקוח בגוף.
  - אם `origin`/`referer` לא קיימים בבקשה, הבקשה תוחזר עם שגיאה 400.
  - כל הפעלה נשמרת עם `siteUrl` שממנו נשלחה הבקשה.
  - אם מתקבלת הפעלה חדשה לאותו אתר (`siteUrl`) עבור אותו רשיון/פלאגין:
    - נוצרת הפעלה חדשה (`activationId` חדש)
    - ההפעלה הפעילה הקודמת לאתר הזה הופכת ל־`is_active=false`
  - אם `allowedActivations` ברשיון הוא `null` → אין הגבלה.
  - אם יש ערך מספרי, נבדק האם כמות **ההפעלות הפעילות** חורגת מהכמות המותרת.

- תגובה:

  ```json
  { "activationId": "UUID" }
  ```

#### 5. בדיקת רשיון לפלאגין

- **POST** `/api/licenses/validate`
- גוף:

  ```json
  {
    "activationId": "ACTIVATION_UUID",
    "pluginId": "PLUGIN_UUID"
  }
  ```

- האימות יצליח רק אם:
  - ההפעלה שייכת לפלאגין (`pluginId`) המבוקש
  - `siteUrl` שנגזר אוטומטית מהבקשה זהה למה שנשמר בהפעלה
  - ההפעלה פעילה (`is_active=true`)
  - והרשיון עצמו עדיין בתוקף

- תגובה:

  ```json
  { "valid": true }
  ```

### פריסה ל-Vercel

1. דחוף את הקוד ל-GitHub.
2. צור פרויקט חדש ב-Vercel וחבר לרפוזיטורי.
3. בהגדרות הפרויקט ב-Vercel, הוסף Environment Variables:
   - `DATABASE_URL`
   - `JWT_SECRET`
4. פרוס (Deploy). Endpoints יהיו זמינים ב:
   - `https://YOUR_DOMAIN/api/token`
   - `https://YOUR_DOMAIN/api/plugins`
   - `https://YOUR_DOMAIN/api/licenses/register`
   - `https://YOUR_DOMAIN/api/licenses/validate`
   - `https://YOUR_DOMAIN/api/licenses/activate`

