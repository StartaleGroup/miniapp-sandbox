#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${RED}Stopping MiniApp Sandbox services...${NC}\n"

if [ -f .pids ]; then
  while read pid; do
    if ps -p $pid > /dev/null 2>&1; then
      echo -e "Stopping process $pid and its children..."
      pkill -P $pid 2>/dev/null
      kill $pid 2>/dev/null
    fi
  done < .pids
  rm .pids
  echo -e "\n${GREEN}✓ All services stopped${NC}\n"
else
  echo -e "${RED}No running services found (.pids file missing)${NC}\n"
fi
