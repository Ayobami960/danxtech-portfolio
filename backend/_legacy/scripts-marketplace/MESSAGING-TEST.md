# Messaging smoke test

## Automated (recommended)

The API must be running and pointed at a reachable Postgres (Redis is optional):

```bash
cd server
npm run dev            # terminal 1
npm run messaging:smoke  # terminal 2
```

`scripts/messaging-smoke.ts` creates a client, a freelancer and an outsider, then
checks live delivery in both directions, the sender's other tab, typing,
presence, unread counts, socket and REST read receipts, cursor pagination,
attachment upload, membership denial, role mismatch, and invalid/expired/revoked
token rejection. It deletes the accounts, conversation and uploaded files.

## Manual REST checks

Log in as each account and keep the `accessToken` from the response:

```bash
API=http://localhost:8080/api/v1

CLIENT_TOKEN=$(curl -s -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"client@example.com","password":"..."}' | jq -r '.data.accessToken')

FREELANCER_TOKEN=$(curl -s -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"freelancer@example.com","password":"..."}' | jq -r '.data.accessToken')

# Freelancer inbox
curl -s "$API/conversations?role=freelancer" \
  -H "Authorization: Bearer $FREELANCER_TOKEN" | jq

# Client opens a conversation with a freelancer (clients only)
curl -s -X POST "$API/conversations?role=client" \
  -H "Authorization: Bearer $CLIENT_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"recipientId":"<freelancer auth_id>"}' | jq

# Send (freelancer replies; role must match the token)
curl -s -X POST "$API/conversations/<id>/messages?role=freelancer" \
  -H "Authorization: Bearer $FREELANCER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"body":"hello from the freelancer"}' | jq

# Newest page first, then pass the returned nextCursor
curl -s "$API/conversations/<id>/messages?role=client&limit=30" \
  -H "Authorization: Bearer $CLIENT_TOKEN" | jq
curl -s "$API/conversations/<id>/messages?role=client&limit=30&cursor=<nextCursor>" \
  -H "Authorization: Bearer $CLIENT_TOKEN" | jq

# Mark read (socket does the same with conversation:read)
curl -s -X POST "$API/conversations/<id>/read?role=client" \
  -H "Authorization: Bearer $CLIENT_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"lastReadMessageId":"<id>"}' | jq
```

## Manual socket check

```js
// node --input-type=module
import { io } from "socket.io-client";

const socket = io("http://localhost:8080", {
  auth: { token: process.env.TOKEN, role: "freelancer" },
});

socket.on("connect", () => console.log("connected", socket.id));
socket.on("connect_error", (error) => console.error("rejected:", error.message));
socket.on("presence:snapshot", (payload) => console.log("online:", payload.userIds));
socket.on("conversation:update", (payload) => console.log("thread changed:", payload));
socket.on("typing:update", (payload) => console.log("typing:", payload));

// Membership is checked server-side.
socket.emit("typing:set", { conversationId: "<id>", isTyping: true });
socket.emit("conversation:read", { conversationId: "<id>", messageId: "<id>" }, console.log);
```

An invalid, expired or revoked token (or a `role` that does not match the
account) is answered with `connect_error`; the dashboards refresh once and
reconnect.
