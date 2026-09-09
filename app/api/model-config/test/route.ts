export const dynamic = 'force-dynamic';

type ModelConfigInput = {
  model_id?: unknown;
  base_url?: unknown;
  api_key?: unknown;
};

function modelsEndpoint(baseUrl: string) {
  const endpoint = new URL(baseUrl);
  endpoint.search = '';
  endpoint.hash = '';

  // 配置中既允许填写 API 根地址（.../v1），也允许粘贴具体调用地址
  // （.../v1/chat/completions、.../v1/images/generations）。后者需要先回到 API 根路径。
  const operationPath =
    /\/(?:chat\/completions|images\/(?:generations|edits|variations)|videos?\/generations|contents\/generations\/tasks)\/?$/;
  if (operationPath.test(endpoint.pathname)) {
    endpoint.pathname = endpoint.pathname.replace(operationPath, '/models');
    return endpoint;
  }

  const normalized = endpoint.href.endsWith('/')
    ? endpoint.href
    : `${endpoint.href}/`;
  return new URL('models', normalized);
}

export async function POST(request: Request) {
  const config = (await request.json()) as ModelConfigInput;
  if (
    typeof config.base_url !== 'string' ||
    typeof config.api_key !== 'string' ||
    typeof config.model_id !== 'string'
  ) {
    return Response.json({ error: '模型配置格式不正确' }, { status: 400 });
  }
  if (
    !config.base_url.trim() ||
    !config.api_key.trim() ||
    !config.model_id.trim()
  ) {
    return Response.json(
      { error: '请先填写模型 ID、接口地址和 API Key' },
      { status: 400 },
    );
  }

  let endpoint: URL;
  try {
    endpoint = modelsEndpoint(config.base_url.trim());
  } catch {
    return Response.json({ error: '接口地址不是有效的 URL' }, { status: 400 });
  }
  if (!['http:', 'https:'].includes(endpoint.protocol)) {
    return Response.json(
      { error: '接口地址仅支持 HTTP 或 HTTPS' },
      { status: 400 },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${config.api_key.trim()}` },
      signal: controller.signal,
    });
    if (response.ok)
      return Response.json({ ok: true, message: '连接成功，接口可用。' });
    if (response.status === 401 || response.status === 403) {
      return Response.json(
        {
          error: `接口可达，但 API Key 无效或没有权限（HTTP ${response.status}）。`,
        },
        { status: 422 },
      );
    }
    return Response.json(
      {
        error: `接口返回 HTTP ${response.status}，请检查接口地址与模型服务状态。`,
      },
      { status: 422 },
    );
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? '连接超时，请检查接口地址或网络。'
        : '无法连接到接口，请检查接口地址和网络。';
    return Response.json({ error: message }, { status: 422 });
  } finally {
    clearTimeout(timeout);
  }
}
