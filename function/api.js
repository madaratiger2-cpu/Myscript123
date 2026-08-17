const { getStore } = require("@netlify/blobs");

const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
};

exports.handler = async (event) => {
    const store = getStore("lua_scripts");
    const method = event.httpMethod;
    const { id, raw } = event.queryStringParameters || {};

    try {
        if (method === "GET" && raw) {
            const content = await store.get(raw);
            if (!content) return { statusCode: 404, headers, body: JSON.stringify({ error: "Not found" }) };
            return {
                statusCode: 200,
                headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
                body: content
            };
        }

        if (method === "GET") {
            if (id) {
                const res = await store.getWithMetadata(id);
                if (!res || !res.data) return { statusCode: 404, headers, body: JSON.stringify({ error: "Not found" }) };
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ id, content: res.data, filename: res.metadata?.filename || id })
                };
            }
            const { blobs } = await store.list();
            return { statusCode: 200, headers, body: JSON.stringify(blobs) };
        }

        const parseBody = () => {
            const rawBody = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
            return JSON.parse(rawBody);
        };

        if (method === "POST") {
            const body = parseBody();
            const newId = Math.random().toString(36).substring(2, 10);
            const filename = body.filename || `script_${newId}.lua`;
            await store.set(newId, body.content, { metadata: { filename } });
            return { statusCode: 200, headers, body: JSON.stringify({ id: newId }) };
        }

        if (method === "PUT") {
            const body = parseBody();
            if (!body.id || !body.content) return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid data" }) };
            await store.set(body.id, body.content, { metadata: { filename: body.filename } });
            return { statusCode: 200, headers, body: JSON.stringify({ id: body.id }) };
        }

        if (method === "DELETE") {
            const body = parseBody();
            if (body.id) await store.delete(body.id);
            return { statusCode: 200, headers, body: JSON.stringify({}) };
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };
    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
