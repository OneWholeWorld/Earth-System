const express = require("express");
const cors = require("cors");
const systemRoutes = require("./routes/systemRoutes");
const avatarRoutes = require("./routes/avatarRoutes");
const goalRoutes = require("./routes/goalRoutes");
const needRoutes = require("./routes/needRoutes");
const mappingRoutes = require("./routes/mappingRoutes");
const logRoutes = require("./routes/logRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

app.use("/api/systems", systemRoutes);
app.use("/api/avatars", avatarRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/needs", needRoutes);
app.use("/api/mappings", mappingRoutes);
app.use("/api/logs", logRoutes);

app.get("/", (req: any, res: any) => {
  res.send("OS POC API is running!");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
