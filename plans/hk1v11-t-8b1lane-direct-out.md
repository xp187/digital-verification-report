# t_8b1lane_DIRECT_OUT 验证计划

## 验证目标与范围

验证CHPI写入直出寄存器后，digital_top输出端口同步变化。

计划范围是核实该 Case 实际配置路径和已有检查点，不修改 Case 激励、寄存器值、状态或波形证据。报告当前状态：`RUN`；状态仅用于定位报告记录，不代表本计划已执行。

## 寄存器与规格依据

- 预期涉及字段：CHIP_SEL=0, direct-output fields across 0x08, 0x21–0x2E, 0x33, 0x35–0x37。
- 报告现有关联：
- HK1V11:0:21:2:0: CHPI写入后检查34个digital_top直出端口，包括reg_eq_rbc0/1（common）
- HK1V11:0:22:6:6: CHPI写入后检查34个digital_top直出端口，包括reg_eq_rbc0/1（common）
- HK1V11:0:22:7:7: CHPI写入后检查34个digital_top直出端口，包括reg_eq_rbc0/1（common）
- HK1V11:0:23:7:4: CHPI写入后检查34个digital_top直出端口，包括reg_eq_rbc0/1（common）
- HK1V11:0:24:5:0: CHPI写入后检查34个digital_top直出端口，包括reg_eq_rbc0/1（common）
- HK1V11:0:25:3:0: CHPI写入后检查34个digital_top直出端口，包括reg_eq_rbc0/1（common）
- HK1V11:0:25:7:4: CHPI写入后检查34个digital_top直出端口，包括reg_eq_rbc0/1（common）
- HK1V11:0:26:2:0: CHPI写入后检查34个digital_top直出端口，包括reg_eq_rbc0/1（common）
- HK1V11:0:26:7:4: CHPI写入后检查34个digital_top直出端口，包括reg_eq_rbc0/1（common）
- HK1V11:0:28:5:4: CHPI写入后检查34个digital_top直出端口，包括reg_eq_rbc0/1（common）
- HK1V11:0:29:5:4: CHPI写入后检查34个digital_top直出端口，包括reg_eq_rbc0/1（common）
- HK1V11:0:29:7:6: CHPI写入后检查34个digital_top直出端口，包括reg_eq_rbc0/1（common）
- HK1V11:0:2A:1:0: CHPI写入后检查34个digital_top直出端口，包括reg_eq_rbc0/1（common）
- HK1V11:0:2A:3:2: CHPI写入后检查34个digital_top直出端口，包括reg_eq_rbc0/1（common）
- HK1V11:0:2A:5:4: CHPI写入后检查34个digital_top直出端口，包括reg_eq_rbc0/1（common）
- HK1V11:0:2A:7:6: CHPI写入后检查34个digital_top直出端口，包括reg_eq_rbc0/1（common）
- HK1V11:0:2B:3:0: CHPI写入后检查34个digital_top直出端口，包括reg_eq_rbc0/1（common）
- HK1V11:0:2B:5:4: CHPI写入后检查34个digital_top直出端口，包括reg_eq_rbc0/1（common）
- HK1V11:0:2B:7:6: CHPI写入后检查34个digital_top直出端口，包括reg_eq_rbc0/1（common）
- HK1V11:0:2C:3:0: CHPI写入后检查34个digital_top直出端口，包括reg_eq_rbc0/1（common）
- HK1V11:0:2C:6:4: CHPI写入后检查34个digital_top直出端口，包括reg_eq_rbc0/1（common）
- HK1V11:0:2D:5:4: CHPI写入后检查34个digital_top直出端口，包括reg_eq_rbc0/1（common）
- HK1V11:0:2D:7:6: CHPI写入后检查34个digital_top直出端口，包括reg_eq_rbc0/1（common）
- HK1V11:0:2E:0:0: CHPI写入后检查34个digital_top直出端口，包括reg_eq_rbc0/1（common）
- HK1V11:0:2E:2:1: CHPI写入后检查34个digital_top直出端口，包括reg_eq_rbc0/1（common）
- HK1V11:0:2E:5:4: CHPI写入后检查34个digital_top直出端口，包括reg_eq_rbc0/1（common）
- HK1V11:0:2E:7:6: CHPI写入后检查34个digital_top直出端口，包括reg_eq_rbc0/1（common）
- HK1V11:0:33:1:1: CHPI写入后检查34个digital_top直出端口，包括reg_eq_rbc0/1（common）
- HK1V11:0:35:1:0: CHPI写入后检查34个digital_top直出端口，包括reg_eq_rbc0/1（common）
- HK1V11:0:36:7:0: CHPI写入后检查34个digital_top直出端口，包括reg_eq_rbc0/1（common）
- HK1V11:0:37:5:0: CHPI写入后检查34个digital_top直出端口，包括reg_eq_rbc0/1（common）
- HK1V11:0:37:6:6: CHPI写入后检查34个digital_top直出端口，包括reg_eq_rbc0/1（common）
- HK1V11:0:08:1:1: CHPI写入后检查34个digital_top直出端口，包括reg_eq_rbc0/1（common）
- HK1V11:0:08:0:0: CHPI写入后检查34个digital_top直出端口，包括reg_eq_rbc0/1（common）
- 对照规格：`E:\projects\HK1V11\HK1V11_spec\05.Register\HK1V11_Register_20261102.xlsm`（HK1V11_Register_20261102）。执行前核对芯片选择、地址、位宽、复位值及 reserved 字段；如配置文件与规格有冲突，先记录差异，不自行改写配置。

## 激励与配置序列

报告中的现有激励摘要：CHIP_SEL=0；3帧依次写基准0、全1、全0；每帧一次写入17个目标地址，保护码保持0x72。

以下表格从当前工程 case 目录的配置文件逐项读取；`cfg_frameN` 对应原测试中的配置帧编号，不扩展或重排场景。

| 配置帧 | BGR_SEL | BGR_TRIM | CN_VBN1L | CN_VBN2L | CN_VBP1R | CN_VBP2R | CP_VBN1L | CP_VBN2L | CP_VBP1R | CP_VBP2R | CVBP_SEPARATE | DBCO_DRV | DCBIAS_CHOP | DCBIAS_TOT | DC_MON_SEL | OVC_NEG | OVC_POS | PWRC_LS | R_MON_DC_VOL | R_PTAT_EN | STR | reg_ana_test_sel | reg_cdr_icp | reg_cdr_rlpf | reg_cr_done_cnt | reg_eq_bias_tune | reg_eq_rbc0 | reg_eq_rbc1 | reg_fbdiv_clk_sel | reg_icp_bias_tune | reg_kvco_ctrl | reg_lane_ck_inv_en | reg_vos_ad_en | reg_vos_ctrl |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| cfg_frame0 | 0000 | 000 | 00 | 00 | 00 | 00 | 00 | 00 | 00 | 00 | 0 | 00 | 0000 | 00 | 00 | 00 | 00 | 00 | 000 | 0 | 0 | 0000 | 0000 | 0000 | 000000 | 00000000 | 0 | 0 | 00 | 000 | 0000 | 0 | 0 | 000000 |
| cfg_frame1 | 1111 | 111 | 11 | 11 | 11 | 11 | 11 | 11 | 11 | 11 | 1 | 11 | 1111 | 11 | 11 | 11 | 11 | 11 | 111 | 1 | 1 | 1111 | 1111 | 1111 | 111111 | 11111111 | 1 | 1 | 11 | 111 | 1111 | 1 | 1 | 111111 |
| cfg_frame2 | 0000 | 000 | 00 | 00 | 00 | 00 | 00 | 00 | 00 | 00 | 0 | 00 | 0000 | 00 | 00 | 00 | 00 | 00 | 000 | 0 | 0 | 0000 | 0000 | 0000 | 000000 | 00000000 | 0 | 0 | 00 | 000 | 0000 | 0 | 0 | 000000 |
| cfg_frame3 | 0000 | 000 | 00 | 00 | 00 | 00 | 00 | 00 | 00 | 00 | 0 | 00 | 0000 | 00 | 00 | 00 | 00 | 00 | 000 | 0 | 0 | 0000 | 0000 | 0000 | 000000 | 00000000 | 1 | 0 | 00 | 000 | 0000 | 0 | 0 | 000000 |
| cfg_frame4 | 0000 | 000 | 00 | 00 | 00 | 00 | 00 | 00 | 00 | 00 | 0 | 00 | 0000 | 00 | 00 | 00 | 00 | 00 | 000 | 0 | 0 | 0000 | 0000 | 0000 | 000000 | 00000000 | 0 | 1 | 00 | 000 | 0000 | 0 | 0 | 000000 |

逐项执行：

1. 按 case 顶层 sequence 完成既有初始化、解锁/寄存器配置和输入图像或协议事务；不改变发送顺序及配置帧边界。
2. 按上表与 `cfg_frame*.txt` 原始内容施加配置变化；在每次配置提交后记录 CHIP_SEL、寄存器地址/数据以及配置生效帧，检查未被本场景覆盖的字段保持预期。
3. 按 Case 原本的帧数、行数或事务次数运行；特别场景及边界值以 `observation`、配置文件和测试源中的实际序列为准，不从 DUT 输出反推激励期望。
4. 保存现有波形和标注，检查失败时关联到当前配置帧、输入窗口和输出采样点；本计划不要求删除或替换已有证据。

## 检查点与通过判据

报告当前检查点：每帧配置生效后逐项比较32个digital_top端口与写入位段；本地静态检查通过，完整DUT仿真待验证。

- 按 case 实际启用的 checker/scoreboard 逐项判定，不新增未经源码确认的精确数值或时序断言。
- 检查配置写入与预期寄存器字段一致，并确认模式切换发生在目标帧/事务；具体采样沿、容差和覆盖量若未在 case/checker 中明确，应在执行记录中标注待确认。
- 没有 UVM_ERROR/FATAL 或 checker mismatch；所有原测试预期的数据比较/协议响应完成，且采样数、帧数或事务数完整。
- 如果当前 case 只开启模拟 checker 或仅有参考图像检查，则只据其实际结果报告；不能把未启用的 digital/data-merge/chopper checker 记为覆盖。

## 代码与 checker 依据

当前 case 目录：`E:\projects\HK1V11\HK1V11_top_20261027\tests\t_8b1lane_DIRECT_OUT`

源文件：`README.md`, `direct_output_checker.sv`, `t_8b1lane_DIRECT_OUT.sv`, `test_lib.sv`, `user_def.sv`, `waves_dumper.sv`

以 case 顶层 sequence、`test_lib.sv` 中实际启用的 checker，以及 case 私有 checker（如有）为执行依据。此附件是验证计划，不是仿真结果；没有在源码中找到的断言不会作为既成事实描述。

## 执行结果记录

- 仿真版本/提交：待填写
- 工具与 seed：待填写
- 实际帧数/事务数：待填写
- 结果及失败日志：待填写
- 未覆盖项/与规格差异：待填写
