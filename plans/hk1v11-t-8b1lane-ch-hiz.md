# t_8b1lane_CH_HIZ 验证计划

## 验证目标与范围

验证 CH12_HIZ/CH34_HIZ 独立或同时强制 STB_A/STB_B 为高，清零后恢复正常输出。

计划范围是核实该 Case 实际配置路径和已有检查点，不修改 Case 激励、寄存器值、状态或波形证据。报告当前状态：`RUN`；状态仅用于定位报告记录，不代表本计划已执行。

## 寄存器与规格依据

- 预期涉及字段：CHIP_SEL=0, 0x22[0] HIZ_SEL and 0x23[3:2] channel HIZ controls。
- 报告现有关联：
- HK1V11:0:22:0:0: 四种通道 HIZ 组合输出（common）
- HK1V11:0:23:3:3: 四种通道 HIZ 组合输出（common）
- HK1V11:0:23:2:2: 四种通道 HIZ 组合输出（common）
- 对照规格：`E:\projects\HK1V11\HK1V11_spec\05.Register\HK1V11_Register_20261102.xlsm`（HK1V11_Register_20261102）。执行前核对芯片选择、地址、位宽、复位值及 reserved 字段；如配置文件与规格有冲突，先记录差异，不自行改写配置。

## 激励与配置序列

报告中的现有激励摘要：CHIP_SEL=0，8帧，3840×16、12 ports、单lane，AABB=00。{CH12_HIZ,CH34_HIZ} 依次为00/10/00/01/00/11/10/00，覆盖四种组合及清零恢复。

以下表格从当前工程 case 目录的配置文件逐项读取；`cfg_frameN` 对应原测试中的配置帧编号，不扩展或重排场景。

| 配置帧 | POL | R_CH12_HIZ | R_CH34_HIZ |
|---|---|---|---|
| cfg_frame0 | 0 | 0 | 0 |
| cfg_frame1 | 1 | 1 | 0 |
| cfg_frame2 | 0 | 0 | 0 |
| cfg_frame3 | 1 | 0 | 1 |
| cfg_frame4 | 0 | 0 | 0 |
| cfg_frame5 | 1 | 1 | 1 |
| cfg_frame6 | 0 | 1 | 0 |
| cfg_frame7 | 1 | 0 | 0 |
| cfg_frame8 | 1 | 0 | 0 |

逐项执行：

1. 按 case 顶层 sequence 完成既有初始化、解锁/寄存器配置和输入图像或协议事务；不改变发送顺序及配置帧边界。
2. 按上表与 `cfg_frame*.txt` 原始内容施加配置变化；在每次配置提交后记录 CHIP_SEL、寄存器地址/数据以及配置生效帧，检查未被本场景覆盖的字段保持预期。
3. 按 Case 原本的帧数、行数或事务次数运行；特别场景及边界值以 `observation`、配置文件和测试源中的实际序列为准，不从 DUT 输出反推激励期望。
4. 保存现有波形和标注，检查失败时关联到当前配置帧、输入窗口和输出采样点；本计划不要求删除或替换已有证据。

## 检查点与通过判据

报告当前检查点：检查 STB_A=STB_A_PRE|CH12_HIZ、STB_B=STB_B_PRE|CH34_HIZ；8帧配置与高/低样本齐全，失配、X/Z、缺样本或超时报错。本地配置及安装检查通过，服务器DUT仿真待执行。本项验证数字STB控制，不包含模拟输出高阻。

- 按 case 实际启用的 checker/scoreboard 逐项判定，不新增未经源码确认的精确数值或时序断言。
- 检查配置写入与预期寄存器字段一致，并确认模式切换发生在目标帧/事务；具体采样沿、容差和覆盖量若未在 case/checker 中明确，应在执行记录中标注待确认。
- 没有 UVM_ERROR/FATAL 或 checker mismatch；所有原测试预期的数据比较/协议响应完成，且采样数、帧数或事务数完整。
- 如果当前 case 只开启模拟 checker 或仅有参考图像检查，则只据其实际结果报告；不能把未启用的 digital/data-merge/chopper checker 记为覆盖。

## 代码与 checker 依据

当前 case 目录：`E:\projects\HK1V11\HK1V11_top_20261027\tests\t_8b1lane_CH_HIZ`

源文件：`README.md`, `ch_hiz_checker.sv`, `t_8b1lane_CH_HIZ.sv`, `test_lib.sv`, `user_def.sv`, `waves_dumper.sv`

以 case 顶层 sequence、`test_lib.sv` 中实际启用的 checker，以及 case 私有 checker（如有）为执行依据。此附件是验证计划，不是仿真结果；没有在源码中找到的断言不会作为既成事实描述。

## 执行结果记录

- 仿真版本/提交：待填写
- 工具与 seed：待填写
- 实际帧数/事务数：待填写
- 结果及失败日志：待填写
- 未覆盖项/与规格差异：待填写
