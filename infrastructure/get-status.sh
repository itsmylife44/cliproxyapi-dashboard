#!/bin/bash
# Returns deployment status as JSON
cat /var/log/cliproxyapi/dashboard-deploy-status.json 2>/dev/null || echo '{"status":"idle","message":"No deployment in progress"}'
