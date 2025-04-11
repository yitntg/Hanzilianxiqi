import { getAssetFromKV } from '@cloudflare/kv-asset-handler'

/**
 * The DEBUG flag will do two things that help during development:
 * 1. we will skip caching on the edge, which makes it easier to debug
 * 2. we will return more readable error pages with details
 */
const DEBUG = false

export default {
  async fetch(request, env, ctx) {
    try {
      // 尝试从KV获取静态资源
      return await getAssetFromKV({
        request,
        waitUntil: ctx.waitUntil.bind(ctx),
      })
    } catch (e) {
      // 如果资源获取失败，返回自定义404页面
      return new Response(`<html>
        <body>
          <h1>汉字笔顺大师PRO - 页面未找到</h1>
          <p>您请求的页面不存在。请返回首页。</p>
          <a href="/">返回首页</a>
        </body>
      </html>`, {
        status: 404,
        headers: { 'Content-Type': 'text/html;charset=UTF-8' },
      })
    }
  },
} 