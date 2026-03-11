# PrimărIA — Ghid de Deployment Producție

## Cerințe Preliminare

- **Server:** Linux (Ubuntu 22.04+ recomandat), minim 2 vCPU, 4 GB RAM, 40 GB SSD
- **Docker** 24+ și **Docker Compose** v2
- **Domeniu** cu certificat SSL (Let's Encrypt sau altul)
- **Port 80/443** deschis pentru trafic HTTP/HTTPS

## 1. Pregătirea Serverului

```bash
# Instalare Docker (dacă nu este deja)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Clonare repository
git clone https://github.com/your-org/primaria.git /opt/primaria
cd /opt/primaria
```

## 2. Configurarea Variabilelor de Mediu

```bash
cp .env.production.example .env
```

Editați `.env` și completați **toate** valorile:

| Variabilă | Descriere | Generare |
|-----------|-----------|----------|
| `POSTGRES_PASSWORD` | Parola PostgreSQL | `openssl rand -base64 24` |
| `NEXTAUTH_SECRET` | Secret sesiuni NextAuth | `openssl rand -base64 32` |
| `AUTH_SECRET` | Identic cu NEXTAUTH_SECRET | — |
| `JWT_SECRET` | Secret JWT portal cetățeni | `openssl rand -base64 32` |
| `PAYMENT_MODE` | Mod plată (`stripe` în producție) | — |
| `STRIPE_MUNICIPAL_PRICE_ID` | Price ID Stripe pentru abonament primărie | Dashboard Stripe |
| `STRIPE_PRICE_COMUNA_ID` | Price ID Stripe pentru tier comuna | Dashboard Stripe |
| `STRIPE_PRICE_ORAS_ID` | Price ID Stripe pentru tier oras | Dashboard Stripe |
| `STRIPE_PRICE_MUNICIPIU_ID` | Price ID Stripe pentru tier municipiu | Dashboard Stripe |
| `ROEID_ENABLED` | Feature flag ROeID (`false` până la integrare certificată) | — |
| `NEXT_PUBLIC_ROEID_ENABLED` | Feature flag UI ROeID (țineți în sync cu `ROEID_ENABLED`) | — |
| `ROEID_CLIENT_ID` | Client ID ROeID (doar când activați integrarea) | Furnizor ROeID |
| `ROEID_CLIENT_SECRET` | Client secret ROeID (doar când activați integrarea) | Furnizor ROeID |
| `REDIS_PASSWORD` | Parola Redis | `openssl rand -base64 24` |
| `MINIO_ACCESS_KEY` | Cheie acces MinIO | `openssl rand -hex 16` |
| `MINIO_SECRET_KEY` | Cheie secretă MinIO | `openssl rand -hex 32` |
| `CNP_ENCRYPTION_KEY` | Cheie criptare CNP (AES-256) | `openssl rand -hex 32` |
| `CNP_TENANT_SALT_SECRET` | Salt hash CNP per tenant | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | URL-ul public al aplicației | `https://primaria.exemplu.ro` |
| `SUPER_ADMIN_EMAIL` | Email super admin | — |
| `SUPER_ADMIN_PASSWORD` | Parola super admin | — |

**Important:** Niciodată nu comiteți fișierul `.env` în repository.

## 3. Configurarea SSL

### Opțiunea A: Let's Encrypt (recomandat)

```bash
# Instalare certbot
sudo apt install certbot

# Generare certificat (opriți nginx dacă rulează pe port 80)
sudo certbot certonly --standalone -d primaria.exemplu.ro

# Certificatele sunt în /etc/letsencrypt/live/primaria.exemplu.ro/
```

### Opțiunea B: Certificat propriu

Plasați certificatele în:
- `/etc/letsencrypt/live/YOUR_DOMAIN/fullchain.pem`
- `/etc/letsencrypt/live/YOUR_DOMAIN/privkey.pem`

### Configurare Nginx

```bash
# Copiați configurația nginx
sudo cp docker/nginx.conf /etc/nginx/sites-available/primaria
sudo ln -s /etc/nginx/sites-available/primaria /etc/nginx/sites-enabled/

# Înlocuiți YOUR_DOMAIN cu domeniul real
sudo sed -i 's/YOUR_DOMAIN/primaria.exemplu.ro/g' /etc/nginx/sites-available/primaria

# Testare și restart
sudo nginx -t && sudo systemctl reload nginx
```

## 4. Lansarea Aplicației

```bash
cd /opt/primaria

# Build și start toate serviciile
docker compose -f docker-compose.production.yml up -d --build
```

Verificați statusul:

```bash
docker compose -f docker-compose.production.yml ps
docker compose -f docker-compose.production.yml logs -f app
```

## 5. Migrarea Bazei de Date

```bash
# Preflight (schema, client, migration status, optional drift check)
docker compose -f docker-compose.production.yml exec app npm run db:preflight

# Rulare migrări Prisma
docker compose -f docker-compose.production.yml exec app npx prisma migrate deploy

# Seed cu date demo (opțional — doar pentru testare)
docker compose -f docker-compose.production.yml exec app npm run db:seed
```

**Important:** `prisma migrate deploy` rulează migrările fără a crea noi migrări. Utilizați `prisma migrate dev` doar în mediul de dezvoltare.

Pentru verificare strictă de drift (migrations vs schema), setați `SHADOW_DATABASE_URL` și rulați:

```bash
docker compose -f docker-compose.production.yml exec app npm run db:preflight:strict
```

Repetiție import/rollback pe staging (după deploy, înainte de producție):

```bash
docker compose -f docker-compose.production.yml exec app npm run ops:import-rehearsal -- --mode checklist --tenant-id <TENANT_ID>
```

Gate script local/CI:

```bash
npm run ops:staging-gate
APP_BASE_URL=https://primaria-staging.exemplu.ro npm run ops:post-deploy-smoke
# opțional, cu verificare import:
TENANT_ID=<TENANT_ID> IMPORT_BATCH_ID=<BATCH_ID> npm run ops:staging-gate -- --verify-import
# opțional, cu verificare rollback:
TENANT_ID=<TENANT_ID> ROLLBACK_BATCH_ID=<BATCH_ID> npm run ops:staging-gate -- --verify-rollback
```

## 6. Verificare Health Check

```bash
curl -s https://primaria.exemplu.ro/api/health | jq .
```

Răspuns așteptat:

```json
{
  "status": "healthy",
  "timestamp": "2026-...",
  "version": "1.0.0",
  "services": {
    "database": "up",
    "redis": "up"
  }
}
```

## 7. Backup-uri

### Backup Automat PostgreSQL

Creați un cron job pentru backup zilnic:

```bash
# /opt/primaria/scripts/backup-db.sh
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/opt/backups/primaria"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

# Dump din containerul PostgreSQL
docker compose -f /opt/primaria/docker-compose.production.yml exec -T postgres \
  pg_dump -U primaria_admin -Fc primaria > "$BACKUP_DIR/primaria_${TIMESTAMP}.dump"

# Păstrare ultimele 30 de backup-uri
ls -t "$BACKUP_DIR"/primaria_*.dump | tail -n +31 | xargs -r rm

echo "Backup completat: primaria_${TIMESTAMP}.dump"
```

```bash
chmod +x /opt/primaria/scripts/backup-db.sh

# Adăugare în crontab — zilnic la 02:00
echo "0 2 * * * /opt/primaria/scripts/backup-db.sh >> /var/log/primaria-backup.log 2>&1" | crontab -
```

### Restaurare Backup

```bash
# Restaurare din backup
docker compose -f docker-compose.production.yml exec -T postgres \
  pg_restore -U primaria_admin -d primaria --clean --if-exists < /opt/backups/primaria/primaria_20260101_020000.dump
```

### Backup MinIO (documente)

```bash
# Instalare mc (MinIO Client)
wget https://dl.min.io/client/mc/release/linux-amd64/mc -O /usr/local/bin/mc
chmod +x /usr/local/bin/mc

# Configurare alias
mc alias set primaria http://localhost:9000 ACCESS_KEY SECRET_KEY

# Backup periodic
mc mirror primaria/primaria-documents /opt/backups/primaria/documents/
```

## 8. Actualizări

```bash
cd /opt/primaria

# Pull ultimele schimbări
git pull origin main

# Rebuild și restart
docker compose -f docker-compose.production.yml up -d --build

# Rulare migrări noi
docker compose -f docker-compose.production.yml exec app npx prisma migrate deploy
```

## 9. Monitorizare

### Loguri

```bash
# Toate serviciile
docker compose -f docker-compose.production.yml logs -f

# Doar aplicația
docker compose -f docker-compose.production.yml logs -f app

# Doar PostgreSQL
docker compose -f docker-compose.production.yml logs -f postgres
```

### Disk Usage

```bash
# Verificare spațiu Docker
docker system df

# Curățare imagini nefolosite
docker image prune -f
```

## 10. Securitate Post-Deploy

- [ ] Schimbați toate parolele din `.env` cu valori generate
- [ ] Configurați firewall (UFW): permiteți doar 22, 80, 443
- [ ] Activați auto-renewal pentru Let's Encrypt: `sudo certbot renew --dry-run`
- [ ] Configurați fail2ban pentru protecție SSH
- [ ] Verificați că porturile interne (5432, 6379, 9000) NU sunt expuse public
- [ ] Setați backup-uri automate (secțiunea 7)
- [ ] Testați restaurarea dintr-un backup

## Structura Serviciilor (Producție)

| Serviciu | Port Intern | Descriere |
|----------|-------------|-----------|
| `app` | 3000 | Next.js (standalone) |
| `postgres` | 5432 | PostgreSQL 16 |
| `pgbouncer` | 6432 | Connection pooling |
| `redis` | 6379 | Cache / Queue |
| `minio` | 9000/9001 | Object storage |
| `nginx` | 80/443 | Reverse proxy (extern) |
