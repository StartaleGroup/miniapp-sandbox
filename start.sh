#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting MiniApp Sandbox...${NC}\n"

# Check if node_modules exists in root
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}Installing dependencies...${NC}"
  pnpm install
fi

# Start sandbox service in background
echo -e "${GREEN}Starting sandbox on port 3100...${NC}"
pnpm dev > sandbox.log 2>&1 &
SANDBOX_PID=$!

# Save PID to file for cleanup
echo $SANDBOX_PID > .pids

echo -e "\n${GREEN}✓ Sandbox started!${NC}"
echo -e "\n${BLUE}URLs:${NC}"
echo -e "  Sandbox: http://localhost:3100"
echo -e "\n${BLUE}Logs:${NC}"
echo -e "  Sandbox: tail -f sandbox.log"
echo -e "\n${YELLOW}To stop, run: ./stop.sh${NC}\n"
