import { getStore } from "@netlify/blobs";

const store = getStore("lua-scripts-store");

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        }
    });
}

export default async function (req) {
    if (req.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type"
            }
        });
    }

    try {
        const url = new URL(req.url);

        if (req.method === "GET") {
            const id = url.searchParams.get("id");

            if (id) {
                const content = await store.get(id);
                if (content === null) {
                    return new Response("Not Found", {
                        status: 404,
                        headers: { "Content-Type": "text/plain; charset=utf-8", "Access-Control-Allow-Origin": "*" }
                    });
                }
                return new Response(content, {
                    status: 200,
                    headers: { "Content-Type": "text/plain; charset=utf-8", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-cache" }
                });
            }

            const { blobs } = await store.list();
            const files = [];

            for (const blob of blobs) {
                let meta = {};
                try {
                    const m = await store.getMetadata(blob.key);
                    meta = m?.metadata || {};
                } catch (e) {}

                files.push({
                    id: blob.key,
                    name: meta.name || blob.key,
                    createdAt: meta.createdAt || null,
                    updatedAt: meta.updatedAt || null
                });
            }

            files.sort((a, b) => String(a.name).localeCompare(String(b.name)));
            return json({ files });
        }

        if (req.method === "POST") {
            const body = await req.json();
            const name = String(body.name || "").trim();
            const content = body.content;

            if (!name || typeof content !== "string") {
                return json({ error: "Missing name or content" }, 400);
            }

            const id = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
            const now = new Date().toISOString();

            await store.set(id, content, {
                metadata: { name, createdAt: now, updatedAt: now }
            });

            return json({ success: true, id, name }, 201);
        }

        if (req.method === "PUT") {
            const body = await req.json();
            const id = String(body.id || "").trim();
            const content = body.content;

            if (!id || typeof content !== "string") {
                return json({ error: "Missing file ID or content" }, 400);
            }

            let oldMeta = {};
            try {
                const old = await store.getMetadata(id);
                oldMeta = old?.metadata || {};
            } catch (e) {}

            const name = String(body.name || "").trim() || oldMeta.name || id;
            const now = new Date().toISOString();

            await store.set(id, content, {
                metadata: { name, createdAt: oldMeta.createdAt || now, updatedAt: now }
            });

            return json({ success: true, id, name });
        }

        if (req.method === "DELETE") {
            const body = await req.json();
            const id = String(body.id || "").trim();

            if (!id) { return json({ error: "Missing file ID" }, 400); }
            await store.delete(id);
            return json({ success: true, id });
        }

        return json({ error: "Method Not Allowed" }, 405);

    } catch (error) {
        return json({ error: error?.message || "Internal Server Error" }, 500);
    }
}
