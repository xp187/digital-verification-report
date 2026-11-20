# t_8b1lane_multi4_bcc 验证计划

## 验证目标与范围

验证四颗 HK1V11 共用一条开漏 BCC3 总线时，逐颗分配 SDID 并完成 EQ 扫描/训练结果交互后，可一次广播 Start Training，再并行完成 8 帧图像传输及各自的数据检查。

计划范围是核实该 Case 实际配置路径和已有检查点，不修改 Case 激励、寄存器值、状态或波形证据。报告当前状态：`RUN`；状态仅用于定位报告记录，不代表本计划已执行。

## 寄存器与规格依据

- 预期涉及字段：以当前 Case cfg_frame*.txt 中写入的配置项为准；请与 20261102 最新寄存器表核对具体字段。。
- 报告现有关联：
- HK1V11:0:A0:4:0: BCC ID assignment checks the responding SDID; the final EQ=14 command checks its echo. Training-result reply is checked for protocol/reply mode, not as direct register readback.（common）
- HK1V11:1:A0:4:0: BCC ID assignment checks the responding SDID; the final EQ=14 command checks its echo. Training-result reply is checked for protocol/reply mode, not as direct register readback.（common）
- HK1V11:0:A1:3:0: BCC ID assignment checks the responding SDID; the final EQ=14 command checks its echo. Training-result reply is checked for protocol/reply mode, not as direct register readback.（common）
- HK1V11:1:A1:3:0: BCC ID assignment checks the responding SDID; the final EQ=14 command checks its echo. Training-result reply is checked for protocol/reply mode, not as direct register readback.（common）
- 对照规格：`E:\projects\HK1V11\HK1V11_spec\05.Register\HK1V11_Register_20261102.xlsm`（HK1V11_Register_20261102）。执行前核对芯片选择、地址、位宽、复位值及 reserved 字段；如配置文件与规格有冲突，先记录差异，不自行改写配置。

## 激励与配置序列

报告中的现有激励摘要：配置四颗 DUT、CH_SEL=1、4 port、DPLC 关闭。启动后按 chip0→chip3 顺序操作，分别分配 SDID 21、22、23、24；仅在对应芯片分配 ID 时拉低其 APAD。每颗依次设置 EQ=0、2、4、6、8、10、12、14；每档 EQ 命令后发送 CHPI training packet 并请求训练结果，最后重新应用 EQ=14 并核对回读 echo。四颗都完成后仅广播一次 Start Training，随后四个 ISPTX 图像 sequence 并行各发 8 帧。每颗的 data_merge、digital_top、analog checker 均开启；共享 BCC 总线只由 chip0 的 BCC scoreboard/monitor 统计，其他三颗关闭 BCC 检查。需要已有 P3 pattern/frame_0.ppm 至 frame_7.ppm，取左上 1280×16 区域；本 case 不生成或安装 PPM。当前网页记录为待完整 UVM/DUT 仿真确认。

以下表格从当前工程 case 目录的配置文件逐项读取；`cfg_frameN` 对应原测试中的配置帧编号，不扩展或重排场景。

| 配置帧 | POL |
|---|---|
| cfg_frame0 | 0 |
| cfg_frame1 | 1 |
| cfg_frame2 | 0 |
| cfg_frame3 | 1 |
| cfg_frame4 | 0 |
| cfg_frame5 | 1 |
| cfg_frame6 | 0 |
| cfg_frame7 | 1 |
| cfg_frame8 | 0 |

逐项执行：

1. 按 case 顶层 sequence 完成既有初始化、解锁/寄存器配置和输入图像或协议事务；不改变发送顺序及配置帧边界。
2. 按上表与 `cfg_frame*.txt` 原始内容施加配置变化；在每次配置提交后记录 CHIP_SEL、寄存器地址/数据以及配置生效帧，检查未被本场景覆盖的字段保持预期。
3. 按 Case 原本的帧数、行数或事务次数运行；特别场景及边界值以 `observation`、配置文件和测试源中的实际序列为准，不从 DUT 输出反推激励期望。
4. 保存现有波形和标注，检查失败时关联到当前配置帧、输入窗口和输出采样点；本计划不要求删除或替换已有证据。

## 检查点与通过判据

报告当前检查点：BCC 共应检查 72 个响应（每颗 1 次 ID 分配、8 次 EQ 设置响应、8 次训练结果响应、1 次最终 EQ echo），pending response 必须清空，响应 SDID/期望字段匹配且无协议错误。四颗均须在 Start Training 后 500 μs 内锁定，并在检查结束前不失锁；四颗各自完成 8 帧 data_merge、每帧恰有 VACT=16 个 analog 样本及 digital scoreboard 比对。四颗图像 sequence 均返回，所有 scoreboard 完成；全局超时 20 ms、图像结束后的 scoreboard drain 上限 200 μs。完整 DUT 仿真结果尚待服务器运行。

- 按 case 实际启用的 checker/scoreboard 逐项判定，不新增未经源码确认的精确数值或时序断言。
- 检查配置写入与预期寄存器字段一致，并确认模式切换发生在目标帧/事务；具体采样沿、容差和覆盖量若未在 case/checker 中明确，应在执行记录中标注待确认。
- 没有 UVM_ERROR/FATAL 或 checker mismatch；所有原测试预期的数据比较/协议响应完成，且采样数、帧数或事务数完整。
- 如果当前 case 只开启模拟 checker 或仅有参考图像检查，则只据其实际结果报告；不能把未启用的 digital/data-merge/chopper checker 记为覆盖。

## 代码与 checker 依据

当前 case 目录：`E:\projects\HK1V11\HK1V11_top_20261027\tests\t_8b1lane_multi4_bcc`

源文件：`README.md`, `multi4_base.sv`, `multi4_checker.sv`, `t_8b1lane_multi4_bcc.sv`, `test_lib.sv`, `user_def.sv`, `waves_dumper.sv`

以 case 顶层 sequence、`test_lib.sv` 中实际启用的 checker，以及 case 私有 checker（如有）为执行依据。此附件是验证计划，不是仿真结果；没有在源码中找到的断言不会作为既成事实描述。

## 执行结果记录

- 仿真版本/提交：待填写
- 工具与 seed：待填写
- 实际帧数/事务数：待填写
- 结果及失败日志：待填写
- 未覆盖项/与规格差异：待填写
