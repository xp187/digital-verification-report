# t_8b1lane_SR_chip_sel0 验证计划

## 验证目标与范围

验证 CHIP_SEL=0 时 0x22 的 SRE、SRER_P、SREF_P、SRER_N、SREF_N 分别控制对应 DRA 输出，并检查 0x09 的新 SR 字段不会干扰旧模式。

计划范围是核实该 Case 实际配置路径和已有检查点，不修改 Case 激励、寄存器值、状态或波形证据。报告当前状态：`RUN`；状态仅用于定位报告记录，不代表本计划已执行。

## 寄存器与规格依据

- 预期涉及字段：CHIP_SEL=1 new slew fields at 0x09; CHIP_SEL=0 legacy fields at 0x22[5:1]。
- 报告现有关联：
- HK1V11:0:22:5:5: CHIP_SEL=0 的旧 SR 控制及模式隔离（—）
- HK1V11:0:22:4:4: CHIP_SEL=0 的旧 SR 控制及模式隔离（—）
- HK1V11:0:22:3:3: CHIP_SEL=0 的旧 SR 控制及模式隔离（—）
- HK1V11:0:22:2:2: CHIP_SEL=0 的旧 SR 控制及模式隔离（—）
- HK1V11:0:22:1:1: CHIP_SEL=0 的旧 SR 控制及模式隔离（—）
- 对照规格：`E:\projects\HK1V11\HK1V11_spec\05.Register\HK1V11_Register_20261102.xlsm`（HK1V11_Register_20261102）。执行前核对芯片选择、地址、位宽、复位值及 reserved 字段；如配置文件与规格有冲突，先记录差异，不自行改写配置。

## 激励与配置序列

报告中的现有激励摘要：基于 t_8b1lane，8 帧，3840×16、12 ports、单 lane、VBP=4、VFP=5。0x22 的控制位 [5:1] 按 mask=0x3E 对应 00、02、06、0A、12、22、3E、3C，其余位保留基础配置；同时 REG09 依次为 00、55、AA、FF、00、55、AA、FF，检查模式隔离。配置通过 base virtual sequence 的 CTRL_F 发送，cfg_frame8 完整重复 frame7。generate_t_8b1lane_SR_chip_sel0.py 在服务器展开 16 个小文件并登记 testname.f；复用 t_8b1lane/pattern，不生成 PPM。源码已生成，服务器完整 DUT/UVM 编译和仿真待验证。

以下表格从当前工程 case 目录的配置文件逐项读取；`cfg_frameN` 对应原测试中的配置帧编号，不扩展或重排场景。

| 配置帧 | POL | SRE | SREF_N | SREF_P | SRER_N | SRER_P | SR_NF | SR_NR | SR_PF | SR_PR |
|---|---|---|---|---|---|---|---|---|---|---|
| cfg_frame0 | 0 | 0 | 0 | 0 | 0 | 0 | 00 | 00 | 00 | 00 |
| cfg_frame1 | 1 | 1 | 0 | 0 | 0 | 0 | 01 | 01 | 01 | 01 |
| cfg_frame2 | 0 | 1 | 0 | 0 | 0 | 1 | 10 | 10 | 10 | 10 |
| cfg_frame3 | 1 | 1 | 0 | 1 | 0 | 0 | 11 | 11 | 11 | 11 |
| cfg_frame4 | 0 | 1 | 0 | 0 | 1 | 0 | 00 | 00 | 00 | 00 |
| cfg_frame5 | 1 | 1 | 1 | 0 | 0 | 0 | 01 | 01 | 01 | 01 |
| cfg_frame6 | 0 | 1 | 1 | 1 | 1 | 1 | 10 | 10 | 10 | 10 |
| cfg_frame7 | 1 | 0 | 1 | 1 | 1 | 1 | 11 | 11 | 11 | 11 |
| cfg_frame8 | 1 | 0 | 1 | 1 | 1 | 1 | 11 | 11 | 11 | 11 |

逐项执行：

1. 按 case 顶层 sequence 完成既有初始化、解锁/寄存器配置和输入图像或协议事务；不改变发送顺序及配置帧边界。
2. 按上表与 `cfg_frame*.txt` 原始内容施加配置变化；在每次配置提交后记录 CHIP_SEL、寄存器地址/数据以及配置生效帧，检查未被本场景覆盖的字段保持预期。
3. 按 Case 原本的帧数、行数或事务次数运行；特别场景及边界值以 `observation`、配置文件和测试源中的实际序列为准，不从 DUT 输出反推激励期望。
4. 保存现有波形和标注，检查失败时关联到当前配置帧、输入窗口和输出采样点；本计划不要求删除或替换已有证据。

## 检查点与通过判据

报告当前检查点：独立 sr_dra_checker.sv 通过 include 放在 case 类内。0x22 的 bit1/2/3/4/5 分别对应 DRA_SRE/SRER_P/SREF_P/SRER_N/SREF_N；该顺序下 f0~7 固定期望为 00000、10000、11000、10100、10010、10001、11111、01111。最后一帧 SRE=0、四个方向字段=1，输出应为 01111。等待 PORSD 后，每帧在 VS 上升沿、BKDU=0 并延迟 100ns 后直接采样 digital-top 的五个 DRA 输出，使用 !== 严格比较；X/Z、失配或不足 8 个样本均报 UVM_ERROR。首帧对齐及 100ns 稳定时间需服务器波形确认；本项检查数字控制引脚，不测模拟电压斜率。

- 按 case 实际启用的 checker/scoreboard 逐项判定，不新增未经源码确认的精确数值或时序断言。
- 检查配置写入与预期寄存器字段一致，并确认模式切换发生在目标帧/事务；具体采样沿、容差和覆盖量若未在 case/checker 中明确，应在执行记录中标注待确认。
- 没有 UVM_ERROR/FATAL 或 checker mismatch；所有原测试预期的数据比较/协议响应完成，且采样数、帧数或事务数完整。
- 如果当前 case 只开启模拟 checker 或仅有参考图像检查，则只据其实际结果报告；不能把未启用的 digital/data-merge/chopper checker 记为覆盖。

## 代码与 checker 依据

当前 case 目录：`E:\projects\HK1V11\HK1V11_top_20261027\tests\t_8b1lane_SR_chip_sel0`

源文件：`README.md`, `sr_dra_checker.sv`, `t_8b1lane_SR_chip_sel0.sv`, `test_lib.sv`, `user_def.sv`, `waves_dumper.sv`

以 case 顶层 sequence、`test_lib.sv` 中实际启用的 checker，以及 case 私有 checker（如有）为执行依据。此附件是验证计划，不是仿真结果；没有在源码中找到的断言不会作为既成事实描述。

## 执行结果记录

- 仿真版本/提交：待填写
- 工具与 seed：待填写
- 实际帧数/事务数：待填写
- 结果及失败日志：待填写
- 未覆盖项/与规格差异：待填写
