# Packaging Review Remote Deployment

Expected public URL:

```text
http://8.136.223.57/packaging-review/001-hyaluronic/
```

Run after uploading `packaging-review-sync-deploy.tar.gz` to `/tmp/`:

From the local Windows project folder:

```powershell
scp output\packaging-review-sync-deploy.tar.gz root@8.136.223.57:/tmp/packaging-review-sync-deploy.tar.gz
ssh root@8.136.223.57
```

On the server:

```bash
set -e
if ! command -v node >/dev/null 2>&1; then
  apt-get update
  apt-get install -y nodejs
fi
ts=$(date +%Y%m%d%H%M%S)
mkdir -p /var/www/packaging-review
if [ -d /var/www/packaging-review ]; then
  mkdir -p /var/backups/packaging-review
  tar czf /var/backups/packaging-review/packaging-review-$ts.tar.gz -C /var/www packaging-review || true
fi
tar xzf /tmp/packaging-review-sync-deploy.tar.gz -C /var/www/packaging-review
mkdir -p /var/lib/packaging-review
chown -R www-data:www-data /var/www/packaging-review /var/lib/packaging-review
cp /var/www/packaging-review/deploy/packaging-review.service /etc/systemd/system/packaging-review.service
systemctl daemon-reload
systemctl enable --now packaging-review.service
systemctl restart packaging-review.service
```

Add the contents of `/var/www/packaging-review/deploy/nginx-packaging-review.conf` inside the existing `server { ... }` block for port 80, then:

```bash
nginx -t
systemctl reload nginx
curl -I http://127.0.0.1:4180/packaging-review/001-hyaluronic/
curl http://127.0.0.1:4180/api/packaging-review/state?project=001-hyaluronic
curl -I http://8.136.223.57/packaging-review/001-hyaluronic/
```
