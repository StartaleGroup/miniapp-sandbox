#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting MiniApp Sandbox services...${NC}\n"

# Check if node_modules exists in root
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}Installing root dependencies...${NC}"
  pnpm install
fi

# Check if node_modules exists in notify
if [ ! -d "notify/node_modules" ]; then
  echo -e "${YELLOW}Installing notify dependencies...${NC}"
  cd notify
  pnpm install
  pnpm rebuild better-sqlite3
  cd ..
fi

# Start notify service in background
echo -e "${GREEN}Starting notification service on port 3200...${NC}"
cd notify
pnpm dev > ../notify.log 2>&1 &
NOTIFY_PID=$!
cd ..

# Wait a bit for notify service to start
sleep 2

# Start sandbox service in background
echo -e "${GREEN}Starting sandbox on port 3100...${NC}"
pnpm dev > sandbox.log 2>&1 &
SANDBOX_PID=$!

# Save PIDs to file for cleanup
echo $NOTIFY_PID > .pids
echo $SANDBOX_PID >> .pids

echo -e "\n${GREEN}✓ Services started!${NC}"
echo -e "\n${BLUE}URLs:${NC}"
echo -e "  Sandbox:      http://localhost:3100"
echo -e "  Notification: http://localhost:3200"
echo -e "\n${BLUE}Logs:${NC}"
echo -e "  Sandbox:      tail -f sandbox.log"
echo -e "  Notification: tail -f notify.log"
echo -e "\n${YELLOW}To stop all services, run: ./stop.sh${NC}\n"
