<script lang="ts">
import { Ref, Component, Vue } from "vue-facing-decorator"

import { FormInstanceFunctions } from "tdesign-vue-next"

import { MdPreview } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'

import { NaApi } from "@/api"
import { ChatbotMessageOrig } from "@/api/native/chatbot"

import Prompts from "./prompt.json"
import sessionStore from "@/store/session"

@Component({
    components: { MdPreview }
})
export default class ChatbotCreate extends Vue {
    public session = sessionStore()

    public useStream = true
    public chatModel = "gpt-3.5-turbo-16k"

    public chatRecord: ChatbotMessageOrig[] = []

    public botAvatar = "assets/image/avatar2.jpg"

    public created() {
        this.getChatModes()
    }

    // 模型表

    public chatModels: string[] = []

    public getChatModes() {
        NaApi.chatbot.models().then(res => {
            this.chatModels = res.map(v => v.Name)
        })
    }

    // 提示词

    public promptList = Prompts
    public promptTags = Prompts.map(v => v.title)

    public promptSearch = ""
    public promptVisible = false

    public promptSwith() {
        this.promptVisible = true
    }

    public promptApply(p: PromptItem) {
        this.formModel.Content = p.desc_cn
        this.promptVisible = false
    }

    public promptFilter(s: string) {
        if (s) {
            this.promptList = Prompts.filter(v => {
                const arr = [
                    v.title, v.title_en,
                    v.remark, v.remark_en,
                    v.description, v.desc_cn,
                    v.tags.join("")
                ]
                return arr.join(",").includes(s)
            })
        } else {
            this.promptList = Prompts
        }
    }

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
        // 构造参数
        const query = {
            Model: this.chatModel,
            Messages: this.chatRecord
        }
        const idx = this.chatRecord.length
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
        this.chatRecord.push({
            Role: "assistant",
            Content: "正在思考..."
        })
    }

    // 清理聊天

    public chatClear(id = -1) {
        if (id < 0) {
            this.chatRecord = []
            this.formRef.reset()
        } else {
            this.chatRecord.splice(id, 1)
        }
    }

    public chatRollback() {
        const l = this.chatRecord.pop()
        this.formModel.Content = l ? l.Content : ""
    }
}

interface PromptItem {
    title: string
    description: string
    desc_cn: string
    remark: string
    title_en: string
    desc_en: string
    remark_en: string
    tags: string[]
    id: number
    weight: number
}
</script>

<template>
    <t-space fixed direction="vertical">
        <t-list v-if="chatRecord.length > 0" stripe>
            <template v-for="item, k of chatRecord" :key="k">
                <t-list-item :class="item.Role">
                    <t-list-item-meta :image="item.Role == 'user' ? session.Avatar : botAvatar">
                        <template #description>
                            <MdPreview v-model="item.Content" :editor-id="'md-' + k" class="message" />
                        </template>
                    </t-list-item-meta>
                    <template v-if="item.Role == 'user' && chatRecord.length == k + 1" #action>
                        <t-button shape="circle" variant="text" @click="chatRollback()">
                            <t-icon name="rollback" />
                        </t-button>
                    </template>
                    <template v-else #action>
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
                    <t-select v-model="chatModel" :readonly="chatModels.length == 0">
                        <t-option v-for="v, k in chatModels" :key="k" :value="v" :label="v" />
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
                        <t-button theme="warning" :disabled="chatRecord.length > 0" @click="promptSwith">
                            <template #icon>
                                <t-icon name="root-list" />
                            </template>
                            提示词
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

        <t-drawer v-model:visible="promptVisible" :close-btn="true">
            <template #header>
                提示词 &nbsp;
                <t-tag size="small">
                    {{ promptList.length }}
                </t-tag>
            </template>
            <t-list class="select-list" stripe>
                <t-list-item v-for="v, k in promptList" :key="k" @click="promptApply(v)">
                    <t-list-item-meta :title="v.title" :description="v.remark" />
                </t-list-item>
            </t-list>
            <template #footer>
                <t-auto-complete v-model="promptSearch" :options="promptTags" @change="promptFilter">
                    <template #suffixIcon>
                        <t-icon name="filter" />
                    </template>
                </t-auto-complete>
            </template>
        </t-drawer>
    </t-space>
</template>

<style lang="scss" scoped>
.message {
    word-wrap: break-word;
    --md-bk-color: transparent;
}

.select-list {
    cursor: pointer;
}
</style>
