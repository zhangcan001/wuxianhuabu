const http = require("http");

const PORT = Number(process.env.MOCK_IMAGE_API_PORT || 8788);
const ONE_PIXEL_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

http
  .createServer(async (req, res) => {
    if (req.method !== "POST") {
      res.writeHead(404);
      res.end();
      return;
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const auth = req.headers.authorization || req.headers["x-api-key"] || "";
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        sawAuth: Boolean(auth),
        data: [{ b64_json: ONE_PIXEL_PNG }],
      }),
    );
  })
  .listen(PORT, "127.0.0.1", () => {
    console.log(`Mock image API listening on http://127.0.0.1:${PORT}`);
  });
