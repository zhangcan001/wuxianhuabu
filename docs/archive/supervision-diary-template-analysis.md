# 个人监理日记模板分析

模板文件：`templates/个人监理日记模板.docx`

## 输出文档结构

文档标题为“监理日记”，主体是一张 Word 表格，包含以下区域：

1. 气候与日期
   - 日期
   - 星期
   - 上午天气
   - 下午天气
   - 最高/最低气温
   - 湿度
   - 风向
   - 风力

2. 一、现场施工情况
   - 在施部位及施工状态
   - 承包单位人员动态
   - 承包单位机械使用情况

3. 二、监理工作情况
   - 巡视/检查工作
   - 材料验收/见证取样工作
   - 验收工作
   - 旁站工作
   - 会议情况
   - 其它内业工作

4. 三、存在问题及处理情况

5. 四、其它事项

6. 五、现场图片

7. 六、总监理工程师签阅意见

8. 日记填写人

## 建议字段

```json
{
  "date": "2026-04-30",
  "weekday": "星期四",
  "weatherMorning": "晴",
  "weatherAfternoon": "晴",
  "temperatureMax": 18,
  "temperatureMin": 13,
  "humidity": 82,
  "windDirection": "东北",
  "windPower": "≤3",
  "constructionStatus": "",
  "contractorPersonnel": "",
  "machinery": "",
  "inspectionWork": "",
  "materialAcceptance": "",
  "acceptanceWork": "无。",
  "standingWork": "无。",
  "meeting": "无。",
  "internalWork": "",
  "issuesAndActions": "",
  "otherMatters": "无。",
  "photos": [],
  "chiefEngineerComments": "",
  "writer": "张灿"
}
```

## 生成重点

- 用户可以输入短句或原始记录，系统负责扩写成正式监理日记语言。
- Word 输出必须尽量保留原模板表格、字号、边框和排版。
- 每日内容应该先保存结构化数据，再由模板生成 Word，避免只保存最终文本导致后续无法复用。
- 图片区域需要预留上传能力，第一版可先生成文字日志，第二版再插入现场图片。

