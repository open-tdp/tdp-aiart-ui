<script lang="ts">
import { Ref, Component, Vue } from "vue-facing-decorator"

import { FormInstanceFunctions } from "tdesign-vue-next"

import { NaApi } from "@/api"
import { ChatbotMessageOrig, ChatbotEngine } from "@/api/native/chatbot"

import Prompts from "./prompt.json"
import sessionStore from "@/store/session"

@Component
export default class ChatbotCreate extends Vue {
    public session = sessionStore()
    public ChatbotEngine = ChatbotEngine
    public Prompts = Prompts

    public useStream = true
    public chatModel = "gpt-3.5-turbo"

    public chatRecord: ChatbotMessageOrig[] = []

    public botAvatar = "assets/image/avatar2.jpg"

    // 创建表单

    @Ref
    public formRef!: FormInstanceFunctions

    public formModel = {
        Content: "",
    }

    public formSubmit() {
        this.chatRecord.push({
            Role: "user",
            Content: this.formModel.Content
        })
        this.formModel.Content = ""
        // 当前索引
        let idx = 0
        // 聊天记录
        const query = {
            Model: this.chatModel,
            Messages: this.chatRecord
        }
        // 流响应模式
        if (this.useStream) {
            const fn = (res: ChatbotMessageOrig) => {
                const r = this.chatRecord[idx]
                if (r.Content == "正在思考...") {
                    r.Content = res.Content
                } else {
                    r.Content += res.Content
                }
            }
            NaApi.chatbot.stream(query, fn).catch(() => {
                this.chatClear(idx)
            })
        }
        // 一次性模式 
        else {
            NaApi.chatbot.create(query).then(
                res => {
                    this.chatRecord[idx].Content = res.Message.Content
                },
                () => {
                    this.chatClear(idx)
                }
            )
        }
        // 延迟模拟数据
        idx = this.chatRecord.push({
            Role: "assistant",
            Content: "正在思考..."
        }) - 1
    }

    // 设置角色

    public promptVisible = false

    public usePrompt(v: string) {
        this.formModel.Content = v
        this.promptVisible = false
    }

    // 清空聊天

    public chatClear(id = -1) {
        if (id >= 0) {
            this.chatRecord.splice(id, 1)
        } else {
            this.chatRecord = []
            this.formRef.reset()
        }
    }
}
</script>

<template>
    <t-space fixed direction="vertical">
        <t-breadcrumb>
            <t-breadcrumb-item to="/">
                首页
            </t-breadcrumb-item>
            <t-breadcrumb-item>
                智能对话
            </t-breadcrumb-item>
        </t-breadcrumb>

        <t-list v-if="chatRecord.length > 0" stripe>
            <template v-for="item, k of chatRecord" :key="k">
                <t-list-item :class="item.Role">
                    <t-list-item-meta :image="item.Role == 'user' ? session.Avatar : botAvatar">
                        <template #description>
                            <div v-markdown="item.Content" class="message" />
                        </template>
                    </t-list-item-meta>
                    <template #action>
                        <t-button shape="circle" variant="text" @click="chatClear(k)">
                            <t-icon name="clear" />
                        </t-button>
                    </template>
                </t-list-item>
            </template>
        </t-list>

        <t-card hover-shadow header-bordered>
            <t-form ref="formRef" :data="formModel" label-width="80px" @submit="formSubmit">
                <t-form-item label="流式响应">
                    <t-radio-group v-model="useStream">
                        <t-radio :value="true" label="开启" />
                        <t-radio :value="false" label="关闭" />
                    </t-radio-group>
                </t-form-item>
                <t-form-item label="语言模型">
                    <t-select v-model="chatModel">
                        <t-option v-for="v, k in ChatbotEngine" :key="k" :value="v" :label="v" />
                    </t-select>
                </t-form-item>
                <t-form-item label="输入内容">
                    <t-textarea v-model="formModel.Content" :autosize="{ minRows: 5, maxRows: 30 }" :maxlength="3072" />
                </t-form-item>
                <t-form-item>
                    <t-space>
                        <t-button theme="primary" type="submit" :disabled="formModel.Content == ''">
                            <template #icon>
                                <t-icon name="relativity" />
                            </template>
                            发送
                        </t-button>
                        <t-button theme="warning" :disabled="chatRecord.length > 0" @click="promptVisible = true">
                            <template #icon>
                                <t-icon name="chart-bubble" />
                            </template>
                            情景模式
                        </t-button>
                        <t-button theme="danger" :disabled="chatRecord.length == 0" @click="chatClear(-1)">
                            <template #icon>
                                <t-icon name="clear" />
                            </template>
                            重新开始
                        </t-button>
                    </t-space>
                </t-form-item>
            </t-form>
        </t-card>

        <t-drawer v-model:visible="promptVisible" header="情景模式" :footer="false" :close-btn="true">
            <t-list class="select-list" stripe>
                <t-list-item v-for="v, k in Prompts.prompts" :key="k" @click="usePrompt(v.prompt)">
                    <t-list-item-meta :title="v.title" :description="v.description" />
                </t-list-item>
            </t-list>
        </t-drawer>
    </t-space>
</template>

<style lang="scss" scoped>
.message {
    word-wrap: break-word;
}

.select-list {
    cursor: pointer;
}
</style>