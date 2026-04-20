# 登录与认证接口指南

> 后端地址：`https://api.apiz.ai`

---

## 目录

- [登录流程概览](#登录流程概览)
- [当前使用的接口](#当前使用的接口)
  - [邮箱密码登录](#1-邮箱密码登录)
  - [邮箱验证码登录](#2-邮箱验证码登录)
  - [发送邮箱验证码](#3-发送邮箱验证码)
  - [Google 登录（获取授权 URL）](#4-google-登录获取授权-url)
  - [Google 登录（回调换 Token）](#5-google-登录回调换-token)
  - [微信扫码（获取二维码）](#6-微信扫码获取二维码)
  - [微信扫码（轮询状态）](#7-微信扫码轮询状态)
  - [获取用户信息](#8-获取用户信息)
  - [忘记密码](#9-忘记密码)
  - [重置密码](#10-重置密码)
- [退出登录](#退出登录)
- [Token 机制](#token-机制)
- [认证依赖（后端）](#认证依赖后端)
- [数据库相关](#数据库相关)
- [前端关键文件索引](#前端关键文件索引)
- [后端关键文件索引](#后端关键文件索引)

---

## 登录流程概览

```
用户访问受保护页面
  ↓
PrivateRoute 检查 localStorage 中的 user_info
  ↓ (无 token)
重定向到 /login?redirect=原路径
  ↓
用户选择登录方式：邮箱密码 / 邮箱验证码 / Google / 微信扫码
  ↓
登录成功 → 返回含 token 的用户数据 → 写入 localStorage(user_info)
  ↓
后续请求自动带 Authorization: Bearer <token>
  ↓
收到 401 → 清除 user_info → 跳转登录页
```

---

## 当前使用的接口

### 1. 邮箱密码登录

| 项目 | 内容 |
|------|------|
| 方法 | `POST` |
| 路径 | `/api/email_login` |
| 前端调用 | `ApiService.email_login()` → `Login.js` |

**请求体：**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**成功响应：** 返回完整用户对象（含 `token`、`id`、`name`、`email` 等），前端直接写入 `localStorage`。

**后端实现：** `app/api/user.py` — 查 `User.email`，校验密码，签发 JWT。

---

### 2. 邮箱验证码登录

| 项目 | 内容 |
|------|------|
| 方法 | `POST` |
| 路径 | `/api/email_login_code` |
| 前端调用 | `ApiService.email_login_code()` → `Login.js` |

**请求体：**

```json
{
  "email": "user@example.com",
  "code": "123456",
  "ref_code": ""
}
```

**说明：** 如果邮箱不存在则自动注册新用户。`ref_code` 用于邀请推荐追踪。

---

### 3. 发送邮箱验证码

| 项目 | 内容 |
|------|------|
| 方法 | `POST` |
| 路径 | `/api/send_email_code` |
| 前端调用 | `ApiService.send_email_code()` → `Login.js` |

**请求体：**

```json
{
  "email": "user@example.com",
  "code_type": 4
}
```

**说明：** `code_type = 4` 表示邮箱验证码。成功返回 `code: 200`。

---

### 4. Google 登录（获取授权 URL）

| 项目 | 内容 |
|------|------|
| 方法 | `GET` |
| 路径 | `/api/auth/google/url` |
| 前端调用 | `ApiService.getGoogleAuthUrl()` → `Login.js` |

**查询参数：**

| 参数 | 说明 |
|------|------|
| `redirect_uri` | 固定为 `{origin}/auth/google/callback` |
| `ref_code` | 可选，邀请码 |
| `ref` | 可选，推荐来源 |

**成功响应：**

```json
{
  "code": 200,
  "data": {
    "url": "https://accounts.google.com/o/oauth2/v2/auth?...",
    "state": "random_state_string"
  }
}
```

前端拿到 `url` 后整页跳转到 Google 授权页。

**后端实现：** `app/api/google_auth.py`

---

### 5. Google 登录（回调换 Token）

| 项目 | 内容 |
|------|------|
| 方法 | `POST` |
| 路径 | `/api/auth/google/callback` |
| 前端调用 | `ApiService.googleCallback()` → `GoogleCallback.js` |

**请求体：**

```json
{
  "code": "google_auth_code",
  "state": "state_string",
  "ref_code": "",
  "ref": "",
  "redirect_uri": "https://apiz.ai/auth/google/callback"
}
```

**说明：** Google 授权成功后回到 `/auth/google/callback`（注意是非 Hash 路径，在 `App.js` 中 HashRouter 之前单独处理），用 `code` 换取用户 Token。

**后端实现：** `app/api/google_auth.py` — 用 code 换 Google access_token，获取 Google 用户信息，匹配或创建用户，签发 JWT。

---

### 6. 微信扫码（获取二维码）

| 项目 | 内容 |
|------|------|
| 方法 | `GET` |
| 路径 | `/api/get_qrcode` |
| 前端调用 | `ApiService.get_qrcode()` → `Login.js` |

**成功响应：** 返回含 `url`、`scene_id` 的对象，前端用 `url` 生成二维码图片，`scene_id` 用于后续轮询。

---

### 7. 微信扫码（轮询状态）

| 项目 | 内容 |
|------|------|
| 方法 | `POST` |
| 路径 | `/api/check_qrcode_status` |
| 前端调用 | `Login.js` 定时轮询 |

**请求体：**

```json
{
  "scene_id": "scene_id_from_qrcode",
  "from_user_id": "",
  "ref_code": ""
}
```

**说明：** 前端每隔数秒调用，直到 `code === 200` 且 `res.data` 返回用户数据。

---

### 8. 获取用户信息

| 项目 | 内容 |
|------|------|
| 方法 | `POST` |
| 路径 | `/api/user_info` |
| 前端调用 | `ApiService.get_user_info()` → `MpLoginByToken.js` |

**请求体：**

```json
{
  "token": "jwt_token_string"
}
```

**说明：** 小程序跳转 Web 端时使用。通过 URL 参数 `?token=xxx` 传入，调用此接口验证并获取完整用户数据。

---

### 9. 忘记密码

| 项目 | 内容 |
|------|------|
| 方法 | `POST` |
| 路径 | `/api/forgot_password` |
| 前端调用 | `Login.js` |

**请求体：**

```json
{
  "email": "user@example.com"
}
```

**说明：** 后端发送含 15 分钟有效期 JWT（`purpose: reset_password`）的重置链接到用户邮箱。前端无论成功失败均提示"已发送"。

---

### 10. 重置密码

| 项目 | 内容 |
|------|------|
| 方法 | `POST` |
| 路径 | `/api/reset_password` |
| 前端调用 | `ResetPassword.js` |

**请求体：**

```json
{
  "token": "reset_jwt_token_from_email_link",
  "new_password": "newPassword123"
}
```

**说明：** `token` 来自邮件链接中的 URL 参数。后端验证 JWT 的 `purpose == reset_password` 且未过期后更新密码。

---

## 退出登录

**无后端 logout 接口。** 前端直接清除 `localStorage` 中的 `user_info` 并跳转到登录页。

```javascript
LocalDataService.set_user_data(null);
history.push('/login?redirect=...');
```

401 响应也会触发同样的逻辑（`setupAuthInterceptor.js`）。

---

## Token 机制

| 项目 | 说明 |
|------|------|
| 算法 | HS256 |
| 签名密钥 | 由后端环境变量配置，详见后端项目 |
| 有效期 | 10 天 |
| Payload | `sub`（用户 ID 字符串）, `exp`, `iat` |
| 存储 | 前端 `localStorage.user_info`；后端同步写入 `User.token` 字段 |
| 刷新 | 无独立 refresh 接口，重新登录获取新 token |

**忘记密码场景使用独立 JWT：** 有效期 15 分钟，payload 额外含 `purpose: reset_password`。

**后端实现：** `app/schemas/user.py` 中的 `ReqToken` 类。

---

## 认证依赖（后端）

| 依赖函数 | 文件 | 说明 |
|----------|------|------|
| `get_api_token_user_info` | `app/api/api_token_user.py` | 从 Header Bearer 或 Body token 解析用户，失败抛 401 |
| `get_api_token_user_info_v2` | 同上 | 宽松版，无 token 时返回 None 不抛错 |
| `get_api_key_v3` | `app/api/v3/auth/dependencies.py` | V3 API Key 认证，兼容 `sk-` Key、UUID api_token、JWT |
| `ReqToken.get_user_id()` | `app/schemas/user.py` | JWT 解码获取 user_id |
| `ReqToken.get_token()` | `app/schemas/user.py` | 签发新 JWT |

---

## 数据库相关

**用户表 `ts_users`** 认证相关字段：

| 字段 | 说明 |
|------|------|
| `phone` | 手机号 |
| `password` | 密码（MD5） |
| `email` | 邮箱 |
| `token` | 当前 JWT |
| `api_token` | UUID 格式的旧版 API Token |
| `google_id` | Google 用户 ID |
| `google_email` | Google 邮箱 |
| `open_id` | 微信 Open ID |
| `unionid` | 微信 Union ID |

**验证码表 `ts_message_code_list`：** 短信/邮箱验证码记录，`code_type=4` 为邮箱验证码。

---

## 前端关键文件索引

| 文件 | 说明 |
|------|------|
| `src/config/api.js` | API 域名与 endpoint 常量定义 |
| `src/api/ApiService.js` | 所有 API 调用方法（fetch 封装） |
| `src/api/LocalDataService.js` | 用户数据的 localStorage 读写 |
| `src/pages/login/Login.js` | 登录页面（邮箱/Google/扫码） |
| `src/pages/login/ResetPassword.js` | 重置密码页面 |
| `src/pages/login/GoogleCallback.js` | Google OAuth 回调处理 |
| `src/pages/login/MpLoginByToken.js` | 小程序 token 登录 |
| `src/router/PrivateRoute.js` | 路由守卫，未登录重定向 |
| `src/setupAuthInterceptor.js` | 全局 fetch 拦截，401 自动跳登录 |

## 后端关键文件索引

| 文件 | 说明 |
|------|------|
| `app/api/user.py` | 用户登录/注册/验证码/密码重置等路由 |
| `app/api/google_auth.py` | Google OAuth 路由 |
| `app/api/api_token_user.py` | 认证依赖函数 |
| `app/schemas/user.py` | JWT 签发/验证、请求 Schema |
| `app/models/user.py` | 用户数据模型 |
| `app/api/v3/auth/` | V3 API Key 管理（非用户登录） |
| `app/services/email_service.py` | 邮件发送服务 |
