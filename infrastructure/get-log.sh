#!/bin/bash
# Returns deployment log
cat /var/log/cliproxyapi/dashboard-deploy.log 2>/dev/null || echo "No deployment log available"
