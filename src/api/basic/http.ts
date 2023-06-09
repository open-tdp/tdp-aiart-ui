import sessionStore from "@/store/session"

import { StorageMan } from "./storage"
import { errMessage, okMessage } from "./notify"

let storage: StorageMan
let session: ReturnType<typeof sessionStore>

export class HttpClient {
    protected api = "/api"

    protected get session() {
        return session || (session = sessionStore())
    }

    protected get storage() {
        return storage || (storage = new StorageMan('http'))
    }

    protected get(url: string, query?: unknown) {
        return this.request({ method: "GET", url, query })
    }

    protected post(url: string, query: unknown) {
        return this.request({ method: "POST", url, query })
    }

    protected async rcache(req: HttpRequest, expiry: number) {
        let res = this.storage.get(req)
        if (!res) {
            res = await this.request(req)
            this.storage.set(req, res, expiry)
        }
        return res
    }

    protected async request(req: HttpRequest, fn?: Callback) {
        // 构造请求头
        const headers: HeadersInit = {
            Accept: "application/json",
            Authorization: "Bearer " + this.session.Token,
            "Content-Type": "application/json",
        }
        if (req.header) {
            Object.assign(headers, req.header)
        }
        // 构造请求参数
        const request: RequestInit = {
            body: JSON.stringify(req.query),
            method: req.method,
            headers,
        }
        // 返回结构数据
        if (typeof fn != 'function') {
            return this.newFetch(req.url, request)
        }
        // 发起流式请求
        return this.newStream(req.url, request, fn)
    }

    protected async newFetch(url: string, req: RequestInit) {
        const resp = await fetch(this.api + url, req)
        const data = await resp.json()
        if (resp.status != 200 && !data) {
            throw new Error("HTTP Error: " + resp.status)
        }
        // 捕获错误信息
        if (data.Error) {
            const err = errMessage(data.Error)
            if (data.Error.Code == 401) {
                session.$reset(), location.reload()
            }
            throw new Error(err)
        }
        // 刷新登录令牌
        if (data.Token) {
            this.session.updateToken(data.Token)
        }
        // 显示提示消息
        if (data.Message) {
            okMessage(data.Message)
        }
        // 处理正确结果
        if (data.Payload) {
            return data.Payload
        }
        return data
    }

    protected async newStream(url: string, req: RequestInit, fn: Callback) {
        const resp = await fetch(this.api + url, req)
        if (resp.status != 200 || !resp.body) {
            const data = await resp.json()
            // 捕获错误信息
            if (data && data.Error) {
                const err = errMessage(data.Error)
                if (data.Error.Code == 401) {
                    session.$reset(), location.reload()
                }
                throw new Error(err)
            }
            throw new Error("HTTP Error: " + resp.status)
        }
        // 获取UTF8的解码
        const reader = resp.body.getReader()
        const encode = new TextDecoder("utf-8")
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const { done, value } = await reader.read()
            if (!done && value) {
                encode.decode(value).split("\n\n").forEach(fn)
                continue
            }
            break
        }
    }

    protected buildQuery(obj: unknown, key?: string) {
        if (!obj && !key) {
            return ""
        }
        if (obj == null) {
            return key + "="
        }
        const result = []
        switch (typeof obj) {
            case "string":
            case "number":
            case "boolean":
                result.push(key + "=" + encodeURIComponent(obj))
                break
            case "object":
                obj && Object.entries(obj).forEach(o => {
                    const [k, v] = o
                    const i = key ? key + "[" + k + "]" : k
                    result.push(this.buildQuery(v, i))
                })
                break
        }
        return result.join("&")
    }
}

export interface HttpRequest {
    method: "GET" | "DELETE" | "POST" | "PATCH"
    header?: HeadersInit
    url: string
    query?: unknown
}

export interface HttpMessage {
    Message: string
}

export type Callback = (d: string) => void
