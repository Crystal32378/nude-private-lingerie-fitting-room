import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const API_BASE = "https://yce-api-01.makeupar.com/s2s/v2.0";

interface FileApiEntry {
  content_type: string;
  file_name: string;
  file_size: number;
  file_id?: string;
  requests?: Array<{ method: string; url: string; headers?: Record<string, string> }>;
}

async function uploadFile(
  apiKey: string,
  file: File,
  name: string
): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const metaRes = await fetch(`${API_BASE}/file`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      files: [
        {
          content_type: file.type || "image/jpeg",
          file_name: name,
          file_size: buffer.length,
        },
      ],
    }),
  });

  if (!metaRes.ok) {
    throw new Error(`File API failed (${metaRes.status})`);
  }
  const metaJson = await metaRes.json();
  const entry: FileApiEntry | undefined = metaJson?.data?.files?.[0];
  const putUrl = entry?.requests?.[0]?.url;
  if (!entry?.file_id || !putUrl) {
    throw new Error("File API returned no upload target");
  }

  const putRes = await fetch(putUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "image/jpeg",
      "Content-Length": String(buffer.length),
    },
    body: new Uint8Array(buffer),
  });
  if (!putRes.ok) {
    throw new Error(`Binary upload failed (${putRes.status})`);
  }

  return entry.file_id;
}

function mapTaskError(error: unknown): string {
  if (typeof error !== "string") return "YouCam V3 processing failed";
  const known: Record<string, string> = {
    error_pose: "Pose could not be detected in your photo. Try a clearer front-facing photo.",
    error_nsfw_content_detected: "The result was blocked by content moderation.",
    error_apply_region_mismatch:
      "This garment does not align with your photo. Try another photo angle.",
    error_invalid_src: "Your photo shows only part of the body. A fuller upper-body shot works best.",
    error_invalid_ref: "The garment reference image is invalid.",
    exceed_max_filesize: "Image is too large.",
  };
  return (
    known[error] ??
    (typeof error === "string" && error.startsWith("error_")
      ? error.replace(/_/g, " ")
      : error)
  );
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.YOUCAM_API_KEY;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, youcamError: "Invalid request body" }, { status: 400 });
  }

  const person = form.get("person");
  const garment = form.get("garment");
  const garmentCategory = (form.get("garmentCategory") as string) || "upper_body";
  const garmentName = ((form.get("garmentName") as string) || "garment").slice(0, 64);

  if (!(person instanceof File) || !(garment instanceof File)) {
    return NextResponse.json(
      { ok: false, youcamError: "Missing person or garment image" },
      { status: 400 }
    );
  }

  // No API key configured — let the client render its side-by-side fallback preview.
  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      fallback: true,
      youcamError: "Virtual try-on is not configured on this deployment.",
    });
  }

  try {
    const [srcFileId, refFileId] = await Promise.all([
      uploadFile(apiKey, person, "person.jpg"),
      uploadFile(apiKey, garment, `${garmentName}.jpg`),
    ]);

    const taskRes = await fetch(`${API_BASE}/task/cloth-v4`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        src_file_id: srcFileId,
        ref_file_id: refFileId,
        garment_category: garmentCategory,
      }),
    });

    if (!taskRes.ok) {
      const errText = await taskRes.text().catch(() => "");
      if (taskRes.status === 401) {
        return NextResponse.json({ ok: false, youcamError: "Invalid YouCam API key" });
      }
      return NextResponse.json({
        ok: false,
        youcamError: `Task creation failed (${taskRes.status})${errText ? `: ${errText.slice(0, 140)}` : ""}`,
      });
    }

    const taskJson = await taskRes.json();
    const taskId: string | undefined = taskJson?.data?.task_id;
    if (!taskId) {
      return NextResponse.json({ ok: false, youcamError: "No task id returned" });
    }

    // Poll until success/failed (max ~100s).
    const deadline = Date.now() + 100_000;
    let status = "processing";
    let payload: {
      data?: { task_status?: string; results?: { url?: string }; error?: unknown };
    } = {};

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2500));
      const pollRes = await fetch(`${API_BASE}/task/cloth-v4/${taskId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: "no-store",
      });
      if (!pollRes.ok) continue;
      payload = await pollRes.json();
      status = payload?.data?.task_status ?? "processing";
      if (status === "success" || status === "failed") break;
    }

    if (status !== "success" || !payload?.data?.results?.url) {
      const err =
        payload?.data?.error != null
          ? mapTaskError(payload.data.error)
          : "Try-on timed out. Please try again.";
      return NextResponse.json({ ok: false, youcamError: err });
    }

    // Download the signed result (TTL link would otherwise expire) and inline it.
    const imgRes = await fetch(payload.data.results.url, { cache: "no-store" });
    if (!imgRes.ok) {
      return NextResponse.json({ ok: true, imageUrl: payload.data.results.url });
    }
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    const dataUrl = `data:${contentType};base64,${imgBuffer.toString("base64")}`;

    return NextResponse.json({ ok: true, imageUrl: dataUrl });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      youcamError: e instanceof Error ? e.message : "Network error during try-on",
    });
  }
}
