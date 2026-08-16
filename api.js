const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
    const store = getStore("lua_scripts");
    const method = event.httpMethod;
    const { id, raw } = event.queryStringParameters || {};

    try {
        if (method === "GET" && raw) {
            const content = await store.get(raw);
            if (!content) return { statusCode: 404, body: "Not found" };
            return {
                statusCode: 200,
                headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
                body: content
            };
        }

        if (method === "GET") {
            if (id) {
                const content = await store.get(id);
                const metadata = await store.getMetadata(id);
                return { statusCode: 200, body: JSON.stringify({ id, content, filename: metadata?.filename || id }) };
            }
            const { blobs } = await store.list();
            return { statusCode: 200, body: JSON.stringify(blobs) };
        }

        if (method === "POST") {
            const body = JSON.parse(event.body);
            const newId = Math.random().toString(36).substring(2, 10);
            const filename = body.filename || `script_${newId}.lua`;
            await store.set(newId, body.content, { metadata: { filename } });
            return { statusCode: 200, body: JSON.stringify({ id: newId }) };
        }

        if (method === "PUT") {
            const body = JSON.parse(event.body);
            if (!body.id || !body.content) return { statusCode: 400, body: "Invalid data" };
            await store.set(body.id, body.content, { metadata: { filename: body.filename } });
            return { statusCode: 200, body: JSON.stringify({ id: body.id }) };
        }

        if (method === "DELETE") {
            const body = JSON.parse(event.body);
            await store.delete(body.id);
            return { statusCode: 200, body: "{}" };
        }

        return { statusCode: 405, body: "Method Not Allowed" };
    } catch (error) {
        return { statusCode: 500, body: error.message };
    }
};
