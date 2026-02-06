# UFW Firewall Configuration

This document describes the required UFW (Uncomplicated Firewall) rules for the CLIProxyAPI dashboard deployment.

## Required Ports

| Port | Protocol | Service | Purpose |
|------|----------|---------|---------|
| 80 | TCP | HTTP | Caddy reverse proxy (HTTP, auto-redirect to HTTPS) |
| 443 | TCP | HTTPS | Caddy reverse proxy (HTTPS for dashboard and API) |
| 443 | UDP | HTTP/3 | Caddy reverse proxy (QUIC/HTTP3 support) |
| 8085 | TCP | OAuth | CLIProxyAPI OAuth callback (primary) |
| 1455 | TCP | OAuth | CLIProxyAPI OAuth callback (alternate) |
| 54545 | TCP | OAuth | CLIProxyAPI OAuth callback (alternate) |
| 51121 | TCP | OAuth | CLIProxyAPI OAuth callback (alternate) |
| 11451 | TCP | OAuth | CLIProxyAPI OAuth callback (alternate) |

## Port 8317 Security Note

**Port 8317 (CLIProxyAPI main API) is NOT exposed externally.**

In `docker-compose.yml`, port 8317 is bound to `127.0.0.1:8317:8317`, which means:
- The port is only accessible from localhost
- External requests cannot reach it directly
- All API traffic is routed through Caddy (ports 80/443)
- Management API endpoints (`/v0/management/*`) are blocked by Caddy for public access

This design ensures:
1. All API requests go through Caddy's security headers and HTTPS
2. Management API is only accessible internally via Docker networks
3. Reduced attack surface (no direct API exposure)

## Setup Commands

### 1. Reset UFW (Optional - Fresh Start)

```bash
sudo ufw --force reset
```

### 2. Set Default Policies

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
```

### 3. Allow SSH (CRITICAL - Do this first!)

```bash
sudo ufw allow 22/tcp comment "SSH access"
```

**WARNING:** Always allow SSH before enabling UFW, or you may lock yourself out of the server.

### 4. Allow Caddy Reverse Proxy Ports

```bash
sudo ufw allow 80/tcp comment "HTTP (Caddy)"
sudo ufw allow 443/tcp comment "HTTPS (Caddy)"
sudo ufw allow 443/udp comment "HTTP/3 (Caddy)"
```

### 5. Allow CLIProxyAPI OAuth Callback Ports

```bash
sudo ufw allow 8085/tcp comment "CLIProxyAPI OAuth (primary)"
sudo ufw allow 1455/tcp comment "CLIProxyAPI OAuth (alt1)"
sudo ufw allow 54545/tcp comment "CLIProxyAPI OAuth (alt2)"
sudo ufw allow 51121/tcp comment "CLIProxyAPI OAuth (alt3)"
sudo ufw allow 11451/tcp comment "CLIProxyAPI OAuth (alt4)"
```

### 6. Enable UFW

```bash
sudo ufw enable
```

### 7. Verify Rules

```bash
sudo ufw status numbered
```

Expected output:

```
Status: active

     To                         Action      From
     --                         ------      ----
[ 1] 22/tcp                     ALLOW IN    Anywhere                   # SSH access
[ 2] 80/tcp                     ALLOW IN    Anywhere                   # HTTP (Caddy)
[ 3] 443/tcp                    ALLOW IN    Anywhere                   # HTTPS (Caddy)
[ 4] 443/udp                    ALLOW IN    Anywhere                   # HTTP/3 (Caddy)
[ 5] 8085/tcp                   ALLOW IN    Anywhere                   # CLIProxyAPI OAuth (primary)
[ 6] 1455/tcp                   ALLOW IN    Anywhere                   # CLIProxyAPI OAuth (alt1)
[ 7] 54545/tcp                  ALLOW IN    Anywhere                   # CLIProxyAPI OAuth (alt2)
[ 8] 51121/tcp                  ALLOW IN    Anywhere                   # CLIProxyAPI OAuth (alt3)
[ 9] 11451/tcp                  ALLOW IN    Anywhere                   # CLIProxyAPI OAuth (alt4)
[10] 22/tcp (v6)                ALLOW IN    Anywhere (v6)              # SSH access
[11] 80/tcp (v6)                ALLOW IN    Anywhere (v6)              # HTTP (Caddy)
[12] 443/tcp (v6)               ALLOW IN    Anywhere (v6)              # HTTPS (Caddy)
[13] 443/udp (v6)               ALLOW IN    Anywhere (v6)              # HTTP/3 (Caddy)
[14] 8085/tcp (v6)              ALLOW IN    Anywhere (v6)              # CLIProxyAPI OAuth (primary)
[15] 1455/tcp (v6)              ALLOW IN    Anywhere (v6)              # CLIProxyAPI OAuth (alt1)
[16] 54545/tcp (v6)             ALLOW IN    Anywhere (v6)              # CLIProxyAPI OAuth (alt2)
[17] 51121/tcp (v6)             ALLOW IN    Anywhere (v6)              # CLIProxyAPI OAuth (alt3)
[18] 11451/tcp (v6)             ALLOW IN    Anywhere (v6)              # CLIProxyAPI OAuth (alt4)
```

## All-in-One Setup Script

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment "SSH access"
sudo ufw allow 80/tcp comment "HTTP (Caddy)"
sudo ufw allow 443/tcp comment "HTTPS (Caddy)"
sudo ufw allow 443/udp comment "HTTP/3 (Caddy)"
sudo ufw allow 8085/tcp comment "CLIProxyAPI OAuth (primary)"
sudo ufw allow 1455/tcp comment "CLIProxyAPI OAuth (alt1)"
sudo ufw allow 54545/tcp comment "CLIProxyAPI OAuth (alt2)"
sudo ufw allow 51121/tcp comment "CLIProxyAPI OAuth (alt3)"
sudo ufw allow 11451/tcp comment "CLIProxyAPI OAuth (alt4)"
sudo ufw --force enable
sudo ufw status numbered
```

## Troubleshooting

### OAuth Callbacks Not Working

If OAuth callbacks fail after UFW is enabled:

1. Verify OAuth ports are open:
   ```bash
   sudo ufw status | grep -E '(8085|1455|54545|51121|11451)'
   ```

2. Test port connectivity from external machine:
   ```bash
   nc -zv YOUR_SERVER_IP 8085
   nc -zv YOUR_SERVER_IP 1455
   nc -zv YOUR_SERVER_IP 54545
   nc -zv YOUR_SERVER_IP 51121
   nc -zv YOUR_SERVER_IP 11451
   ```

3. Check UFW logs:
   ```bash
   sudo tail -f /var/log/ufw.log
   ```

### Dashboard/API Not Accessible

If dashboard or API is not accessible:

1. Verify Caddy ports are open:
   ```bash
   sudo ufw status | grep -E '(80|443)'
   ```

2. Test HTTP/HTTPS connectivity:
   ```bash
   curl -I http://YOUR_SERVER_IP
   curl -I https://dashboard.YOUR_DOMAIN
   curl -I https://api.YOUR_DOMAIN
   ```

3. Check Caddy container logs:
   ```bash
   docker logs cliproxyapi-caddy
   ```

### Locked Out of Server

If you accidentally locked yourself out:

1. Access via console (cloud provider dashboard, KVM, physical access)
2. Disable UFW temporarily:
   ```bash
   sudo ufw disable
   ```
3. Fix SSH rule and re-enable:
   ```bash
   sudo ufw allow 22/tcp
   sudo ufw enable
   ```

## Security Best Practices

### 1. Restrict SSH to Specific IPs

Instead of allowing SSH from anywhere, restrict to known IPs:

```bash
sudo ufw delete allow 22/tcp
sudo ufw allow from YOUR_IP_ADDRESS to any port 22 proto tcp comment "SSH from trusted IP"
```

### 2. Enable UFW Logging

```bash
sudo ufw logging on
```

### 3. Rate Limiting for SSH

Protect against brute-force attacks:

```bash
sudo ufw limit 22/tcp comment "SSH with rate limiting"
```

### 4. Monitor Active Connections

```bash
sudo netstat -tunlp | grep LISTEN
```

### 5. Review UFW Logs Regularly

```bash
sudo tail -n 100 /var/log/ufw.log
```

## Cloud Provider Firewall Integration

If deploying on cloud infrastructure (AWS, GCP, Azure, DigitalOcean), configure both UFW and the cloud provider's firewall:

### AWS Security Groups

Create inbound rules matching UFW configuration:
- Type: HTTP, Port: 80, Source: 0.0.0.0/0
- Type: HTTPS, Port: 443, Source: 0.0.0.0/0
- Type: Custom TCP, Port: 8085, Source: 0.0.0.0/0
- Type: Custom TCP, Port: 1455, Source: 0.0.0.0/0
- Type: Custom TCP, Port: 54545, Source: 0.0.0.0/0
- Type: Custom TCP, Port: 51121, Source: 0.0.0.0/0
- Type: Custom TCP, Port: 11451, Source: 0.0.0.0/0
- Type: Custom UDP, Port: 443, Source: 0.0.0.0/0

### GCP Firewall Rules

```bash
gcloud compute firewall-rules create cliproxyapi-web \
  --allow tcp:80,tcp:443,udp:443 \
  --source-ranges 0.0.0.0/0 \
  --description "HTTP/HTTPS/HTTP3 for Caddy"

gcloud compute firewall-rules create cliproxyapi-oauth \
  --allow tcp:8085,tcp:1455,tcp:54545,tcp:51121,tcp:11451 \
  --source-ranges 0.0.0.0/0 \
  --description "OAuth callback ports for CLIProxyAPI"
```

### DigitalOcean Firewall

Create firewall with inbound rules:
- Protocol: TCP, Ports: 80, 443, Sources: All IPv4, All IPv6
- Protocol: UDP, Port: 443, Sources: All IPv4, All IPv6
- Protocol: TCP, Ports: 8085, 1455, 54545, 51121, 11451, Sources: All IPv4, All IPv6

## Verification Checklist

After completing UFW setup:

- [ ] SSH access still works (test before logging out!)
- [ ] UFW status shows all required ports open
- [ ] Dashboard accessible via `https://dashboard.YOUR_DOMAIN`
- [ ] API accessible via `https://api.YOUR_DOMAIN`
- [ ] Management API blocked: `curl https://api.YOUR_DOMAIN/v0/management/` returns 403
- [ ] OAuth callback ports respond to connections (test with netcat)
- [ ] Port 8317 is NOT accessible externally: `nc -zv YOUR_IP 8317` should timeout
- [ ] HTTP/3 working: `curl --http3 https://dashboard.YOUR_DOMAIN`
- [ ] UFW logging enabled and logs being written to `/var/log/ufw.log`

## Additional Resources

- [UFW Documentation](https://help.ubuntu.com/community/UFW)
- [CLIProxyAPI OAuth Requirements](https://github.com/router-for-me/CLIProxyAPI#oauth-callback-ports)
- [Caddy HTTP/3 Support](https://caddyserver.com/docs/caddyfile/options#protocols)
