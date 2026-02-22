# Security Best Practices

← [Back to README](../README.md)

## Best Practices

1. **Use a Strong Password**: Choose a strong password during the initial setup wizard

2. **Secure Environment File**:
   ```bash
   chmod 600 infrastructure/.env
   # Never commit .env to version control
   ```

3. **Rotate Secrets Regularly**:
   ```bash
   # Generate new secrets
   openssl rand -base64 32  # JWT_SECRET
   openssl rand -hex 32     # MANAGEMENT_API_KEY
   # Update .env and restart services
   ```

4. **Firewall Configuration**:
   - Only open required ports
   - Use `ufw limit` for SSH to enable rate limiting
   - Consider IP whitelisting for SSH access

5. **Regular Updates**:
   ```bash
   cd infrastructure
   docker compose pull
   docker compose up -d
   ```

   Dashboard updates can also be applied from the Settings page in the admin panel.

6. **Monitor Logs**:
   ```bash
   docker compose logs -f --tail=100
   ```

7. **Automated Backups**:
   - Enable daily or weekly backups during installation
   - Store backups off-server
   - Test restore procedures regularly
   - Encrypt backups for remote storage

8. **Database Security**:
   - PostgreSQL is on isolated internal network (no internet access)
   - Use strong passwords for database credentials
   - Regularly update PostgreSQL image

9. **TLS Configuration**:
   - Caddy automatically provisions Let's Encrypt certificates
   - Certificates auto-renew before expiration
   - HTTPS enforced for all connections