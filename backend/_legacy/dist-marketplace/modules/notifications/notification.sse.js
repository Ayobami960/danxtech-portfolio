const userClients = new Map();
const agencyClients = new Map();
const addClient = (registry, key, response) => {
    const clients = registry.get(key) ?? new Set();
    clients.add(response);
    registry.set(key, clients);
    return () => {
        clients.delete(response);
        if (!clients.size)
            registry.delete(key);
    };
};
export const addNotificationClient = (userId, response) => addClient(userClients, userId, response);
export const addAgencyNotificationClient = (agencyId, response) => addClient(agencyClients, agencyId, response);
const write = (registry, key, notification) => {
    const data = `event: notification\ndata: ${JSON.stringify(notification)}\n\n`;
    const clients = registry.get(key);
    if (!clients)
        return;
    for (const client of clients) {
        try {
            client.write(data);
        }
        catch (error) {
            // A client that has gone away would otherwise stay in the registry (and
            // stop the other clients on this key from being written to).
            console.error("Failed to write to a notification stream; dropping it.", error);
            clients.delete(client);
        }
    }
    if (!clients.size)
        registry.delete(key);
};
export const emitNotification = (userId, notification) => write(userClients, userId, notification);
export const emitAgencyNotification = (agencyId, notification) => write(agencyClients, agencyId, notification);
//# sourceMappingURL=notification.sse.js.map