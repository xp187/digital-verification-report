# t_8b1lane_SMART_CS_value 验证计划

## 验证目标与范围

验证 SMART_CS[3:0] 在 CHIP_SEL=1 时的使能/关闭行为，以及 0111、1111 两档 DRA_CS 脉宽和电荷共享输出。

计划范围是核实该 Case 实际配置路径和已有检查点，不修改 Case 激励、寄存器值、状态或波形证据。报告当前状态：`RUN`；状态仅用于定位报告记录，不代表本计划已执行。

## 寄存器与规格依据

- 预期涉及字段：CHIP_SEL 0/1, 0x02[7:6] and 0x02[3:2] SMART_CS fields。
- 报告现有关联：
- HK1V11:1:02:7:6: SMART_CS 使能值、严格阈值与通道选择（—）
- HK1V11:1:02:3:2: SMART_CS 使能值、严格阈值与通道选择（—）
- HK1V11:0:02:7:6: SMART_CS 使能值、严格阈值与通道选择（—）
- HK1V11:0:02:3:2: SMART_CS 使能值、严格阈值与通道选择（—）
- 对照规格：`E:\projects\HK1V11\HK1V11_spec\05.Register\HK1V11_Register_20261102.xlsm`（HK1V11_Register_20261102）。执行前核对芯片选择、地址、位宽、复位值及 reserved 字段；如配置文件与规格有冲突，先记录差异，不自行改写配置。

## 激励与配置序列

报告中的现有激励摘要：8 帧，CH_SEL=001；f0~7 的 SMART_CS 依次为 0000、0001、0111、0111、1111、1111、1110、1100，cfg_frame8 重复 1100。f2/f3 和 f4/f5 保持相同配置，减少逐帧切换对流水线尾部的干扰；缓冲帧纯色图案尚未在本地落实，当前 pattern 仅有黑白交替行规格，无 PPM。开启 data-merge、digital-top、analog 检查，关闭 chopper。checker 等 PORSD 后只在起始等待一次 VS，各帧以 R_BKDU 上升沿结束；仅监测 R_BKDU=0 时开始的脉冲，输出 scs_check_report.md。

以下表格从当前工程 case 目录的配置文件逐项读取；`cfg_frameN` 对应原测试中的配置帧编号，不扩展或重排场景。

| 配置帧 | CTRLF_CHECKSUM | POL | SMART_CS |
|---|---|---|---|
| cfg_frame0 | 0101 | 0 | 0000 |
| cfg_frame1 | 0101 | 1 | 0001 |
| cfg_frame2 | 0101 | 0 | 0111 |
| cfg_frame3 | 0101 | 1 | 0111 |
| cfg_frame4 | 0101 | 0 | 1111 |
| cfg_frame5 | 0101 | 1 | 1111 |
| cfg_frame6 | 0101 | 0 | 1110 |
| cfg_frame7 | 0101 | 1 | 1100 |
| cfg_frame8 | — | 0 | — |

逐项执行：

1. 按 case 顶层 sequence 完成既有初始化、解锁/寄存器配置和输入图像或协议事务；不改变发送顺序及配置帧边界。
2. 按上表与 `cfg_frame*.txt` 原始内容施加配置变化；在每次配置提交后记录 CHIP_SEL、寄存器地址/数据以及配置生效帧，检查未被本场景覆盖的字段保持预期。
3. 按 Case 原本的帧数、行数或事务次数运行；特别场景及边界值以 `observation`、配置文件和测试源中的实际序列为准，不从 DUT 输出反推激励期望。
4. 保存现有波形和标注，检查失败时关联到当前配置帧、输入窗口和输出采样点；本计划不要求删除或替换已有证据。

## 检查点与通过判据

报告当前检查点：cfg SMART_CS 与 DUT 比对；关闭值不允许活动区 DRA_CS 脉冲。0111 脉宽 600ns±12%（528~672ns），1111 为 300ns±12%（264~336ns）。DRA_CS 上升后 10ns、信号仍高时，单次检查 ch0~959 完整 10-bit SIM_OUT=0x088。行分类在 STB_A 下降后 10ns 确认 BKDU，再等待 400ns 采通道0低8位：>128 为 H、<15 为 L，中间灰阶/X/Z/blank 中断关联；脉冲匹配最近采样边界，H→L 恰1个、L→H 为0，末行 H→L 允许0个。SCS_LINE（UVM_HIGH）及 H/L/unknown 统计用于定位采样问题。

- 按 case 实际启用的 checker/scoreboard 逐项判定，不新增未经源码确认的精确数值或时序断言。
- 检查配置写入与预期寄存器字段一致，并确认模式切换发生在目标帧/事务；具体采样沿、容差和覆盖量若未在 case/checker 中明确，应在执行记录中标注待确认。
- 没有 UVM_ERROR/FATAL 或 checker mismatch；所有原测试预期的数据比较/协议响应完成，且采样数、帧数或事务数完整。
- 如果当前 case 只开启模拟 checker 或仅有参考图像检查，则只据其实际结果报告；不能把未启用的 digital/data-merge/chopper checker 记为覆盖。

## 代码与 checker 依据

当前 case 目录：`E:\projects\HK1V11\HK1V11_top_20261027\tests\t_8b1lane_SMART_CS_value`

源文件：`bcc_model1_smoke.sv`, `smart_cs_checker.sv`, `smart_cs_checker_bk.sv`, `t_8b1lane_SMART_CS_value.sv`, `test_lib.sv`, `user_def.sv`, `waves_dumper.sv`

以 case 顶层 sequence、`test_lib.sv` 中实际启用的 checker，以及 case 私有 checker（如有）为执行依据。此附件是验证计划，不是仿真结果；没有在源码中找到的断言不会作为既成事实描述。

## 执行结果记录

- 仿真版本/提交：待填写
- 工具与 seed：待填写
- 实际帧数/事务数：待填写
- 结果及失败日志：待填写
- 未覆盖项/与规格差异：待填写
