const systemService = require("../services/systemService");
const messageService = require("../services/messageService");

class DashboardController {
  getDashboard(req, res) {
    const systems = systemService.getAllSystems();
    const systemsList = systems
      .map(
        (s) =>
          `<li><strong>${s.name}</strong> (${s.systemId}) - Port: ${s.port} - Status: ${s.status}</li>`
      )
      .join("");

    const recentMessages = messageService
      .getMessageLogs({ limit: 10 })
      .map((msg) => {
        const fromSystem = systemService.getSystem(msg.fromSystemId);
        const toSystem = systemService.getSystem(msg.toSystemId);
        return `<li>${msg.timestamp}: ${
          fromSystem?.name || msg.fromSystemId
        } → ${toSystem?.name || msg.toSystemId} (${msg.messageType})</li>`;
      })
      .join("");

    const totalMessages = messageService.getMessageCount();

    res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>One Whole World Operating System</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; }
                    .container { max-width: 800px; }
                    .section { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
                    .status { color: green; font-weight: bold; }
                    ul { list-style-type: none; padding: 0; }
                    li { margin: 5px 0; padding: 5px; background: #f9f9f9; border-radius: 3px; }
                    .stats { display: flex; gap: 20px; }
                    .stat { background: #e8f5e8; padding: 10px; border-radius: 5px; text-align: center; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🌍 One Whole World Operating System</h1>
                    <p class="status">System Status: Active</p>
                    
                    <div class="stats">
                        <div class="stat">
                            <h3>${systems.length}</h3>
                            <p>Registered Systems</p>
                        </div>
                        <div class="stat">
                            <h3>${totalMessages}</h3>
                            <p>Total Messages</p>
                        </div>
                        <div class="stat">
                            <h3>${
                              systems.filter((s) => s.status === "active")
                                .length
                            }</h3>
                            <p>Active Systems</p>
                        </div>
                    </div>
                    
                    <div class="section">
                        <h2>Registered Systems</h2>
                        <ul>${
                          systemsList || "<li>No systems registered</li>"
                        }</ul>
                    </div>
                    
                    <div class="section">
                        <h2>Recent Messages</h2>
                        <ul>${recentMessages || "<li>No messages yet</li>"}</ul>
                    </div>
                    
                    <div class="section">
                        <h3>API Endpoints</h3>
                        <ul>
                            <li>POST /api/systems/register - Register a new system</li>
                            <li>POST /api/systems/heartbeat - Send heartbeat</li>
                            <li>GET /api/systems - List all systems</li>
                            <li>POST /api/messages/send - Send message between systems</li>
                            <li>GET /api/messages/:systemId - Poll for messages</li>
                            <li>POST /api/messages/acknowledge - Acknowledge message</li>
                            <li>GET /api/messages/logs - View communication logs</li>
                            <li>GET /api/health - Health check</li>
                        </ul>
                    </div>
                </div>
            </body>
            </html>
        `);
  }
}

module.exports = new DashboardController();
