# TEST_PRTCT 验证计划

## 目标与依据

验证寄存器 `0x30 TEST_PRTCT[7:0]`（默认 `8'h00`）作为 LSI 保护解锁钥匙的完整行为：

1. 写入路径不被拦截：任何值都存入 `LC_CPUWR.R_REG48_F`。
2. 解锁判定：`assign LSI_PRTECT = (R_REG48_F == 8'h72)`，只有 `0x72` 解锁（`LC_CPUWR.v:366-367`）。
3. 锁定时全部受保护字段输出强制为复位默认值（`LC_CPUWR.v:403-586` 各 `LSI_PRTECT ?` assign）。
4. 解锁时全部受保护字段输出跟随存储值。
5. 复位默认即锁定（RSTN 复位域）。

写入路径全部走 CHPI 配置帧（cfg_frame 字段经 `isprx_env_cfg` 组包为 CTRL_F 负载，DUT 侧 `FCONFIG_ADD/ADDRxx_F_TEST` 写入），不使用 I2C。读回掩码 `REGRD_NOML`（I2C 读 mux）不在本计划范围内。

参考：`LC_CPUWR.v`、`cmodel/test/HV2A31/HK1V11_digital_top/seperated_code`；检查机制参照 `agents/isprx_env/auto_script/chpi_generated/cfg_frame_get_cfg_val_chip0.sv`（层次引用读 DUT 字段）与 `cfg_frame_all_checks_chip0_pwd_mismatch.sv`（锁定期保护字段默认值期望表）；既有 case `t_8b1lane_TESTO_SEL` 已证明 CHPI 每帧写 `TEST_PRTCT=0x72` 可行，`t_8b1lane_TEST_PRTCT0` 为旧空壳 case，本 case 独立新建。

## 受保护字段清单（锁定时输出回退默认值）

来源 `LC_CPUWR.v` 输出 assign（行号见当前 writable 树）：

| 寄存器 | 字段（锁定时默认值） |
|---|---|
| 0x20 | R_TESTO_SEL(6'h00)、R_TESTO_EN_OPT(0)、PWRC_TSEL(0) |
| 0x21 | R_MON_DC_VOL(3'b000)、R_UTC(2'b00)、R_FRM_CHK_MODE(0) |
| 0x22 | R_HIZ_SEL、SRE、SRER_P、SREF_P、SRER_N、SREF_N、STR、CVBP_SEPARATE（均 0） |
| 0x23 | R_OHIZ_12(0)、R_OHIZ_34(0)、reg_ana_test_sel(4'b0000) |
| 0x24 | reg_cr_done_cnt(6'b010101)、cr_done_filter(2'b00) |
| 0x25 | reg_cdr_rlpf(4'b1100) |
| 0x26 | reg_icp_bias_tune(3'b100)、reg_kvco_ctrl(Loop_sel 默认 A/8) |
| 0x28 | R_AABB(2'b00)、R_BAC(0)、DBCO_DRV(2'b00)、VPS_EN_0(0)、R_DBC_VBK_ON(0) |
| 0x29 | R_DBC(0)、R_DBC_WIDTH_OPT(2'b01)、R_MASK_6PIX(0)、CP_VBP1R(2'b00)、CP_VBP2R(2'b00) |
| 0x2A | OVC_POS(2'b10)、OVC_NEG(2'b01)、CP_VBN1L(2'b00)、CP_VBN2L(2'b00) |
| 0x2B | DCBIAS_CHOP(4'b0000)、DCBIAS_TOT(2'b00)、DC_MON_SEL(2'b00) |
| 0x2C | BGR_SEL(4'b0000)、BGR_TRIM(3'b000) |
| 0x2D | R_LENB_SHIFT(2'b00)、CN_VBP1R(2'b00)、CN_VBP2R(2'b00) |
| 0x2E | R_PTAT_EN(0)、R_PWRC_LS(2'b00)、R_TP_F_AHEAD(0)、CN_VBN1L(2'b00)、CN_VBN2L(2'b00) |
| 0x2F | R_HIZ_MIN_SEL(0)、R_HIZ_MIN_VAL(5'b00000)、R_LD_D_OPT(0) |
| 0x33 | reg_pin_eq(0)、reg_lane_ck_inv_en(0)、CG_OFF(0) |
| 0x35 | reg_fbdiv_clk_sel(2'b00) |
| 0x36 | reg_eq_bias_tune(8'h17) |
| 0x37 | reg_vos_ctrl(6'b100000)、reg_vos_ad_en(1) |
| 0x38 | UTC_header_cnt(2'b01)、UTC_long01_frame(2'b01)、reg_pin_eol_det(1)、reg_eol_det(0)、reg_eol(0) |
| 0x39 | UTC_header_frame(3'b011) |
| 0x90/0x91 | reg_fast_lock_rlpf(4'b0110)、reg_fast_lock_icp(4'b1000)、reg_fine_lock_rlpf(4'b0011)、reg_fine_lock_icp(4'b1100) |
| 0x92 | FSEL(2'b00)、reg_pbs_flt(0)、reg_lock_wd_sel(2'b10) |
| 0x93 | BCC_M(4'b0010) |

非保护字段（0x00~0x1F 常规配置：POL、PORSD、CH_SEL、SCREN、AVE_*、DPLC_*、CTRLF_CHECKSUM、PWRC_P/N、VBK_EN、ACS_EN、Skip_frame 系列、EQ/VOS 之外的链路配置等）不受 LSI_PRTECT 门控，每帧写入立即生效。0x34[5:0] lane 状态与 regr_BCC_M/SDID/AEQ 为只读状态，不参与写入比对。

## 激励

单 lane，FRAME_NUM=8，共 9 次 TEST_PRTCT 写入：cfg_frame0 在训练后立即发送，cfg_frame1~8 在图像帧 1~8 的 VFP 发送。每帧 CTRL_F 全字段重写，按帧只变 `TEST_PRTCT` 与安全字段：

| 帧 | TEST_PRTCT | 状态 | 安全字段（0x20~0x23 测试/监测、0x2B/0x2C 偏置等） | CDR/时钟/UTC 等敏感字段 |
|---|---|---|---|---|
| 0 | 0x00 | 锁定（复位默认即锁） | 非默认 | 非默认 |
| 1 | 0x71 | 锁定（边界 -1） | 非默认 | 非默认 |
| 2 | 0x72 | 解锁 | 非默认 | 默认 |
| 3 | 0x73 | 锁定（边界 +1） | 非默认 | 非默认 |
| 4 | 0x72 | 再解锁（可重入） | 非默认 | 默认 |
| 5 | 0xFF | 锁定（全 1 边界） | 非默认 | 非默认 |
| 6 | 0x72 | 解锁 | 监测/偏置安全子集全 1 | 默认 |
| 7 | 0x72 | 解锁 | 归 0 | 默认 |
| 8 | 0x72 | 解锁（保护尾帧，重复帧 7） | 归 0 | 默认 |

约束：

- 锁定帧可对全部受保护字段（含敏感字段）写非默认值，输出被门控不影响链路；**每个解锁帧必须把敏感字段（CDR fast/fine lock、cr_done、FSEL、fbdiv、EQ bias、VOS、UTC、CG_OFF、DBC/AABB 等）写回默认**，防止锁定期残留值在解锁后生效破坏链路。
- 非保护字段全程使用链路安全值（与正常 case 一致）。
- 每帧正常发送 CTRL_L/LSP 与数据，帧间 guard 空闲，保证写入窗口与观测窗口分离。
- 解锁帧中安全字段写非默认值只驱动测试/监测输出，不触碰链路信号。
- data_merge、digital_top、analog 检查保持开启。

## Checker 与通过条件

每帧配置写入窗口结束后做全字段比对（复用/仿照 `get_cfg_val` + `check_cfg_signal` 机制，为本 case 生成 8 帧全字段检查）：

1. **TEST_PRTCT 自身**：每帧 `R_REG48_F == 写入值`，且 `LSI_PRTECT == (R_REG48_F == 8'h72)`；9 档值（00/71/72/73/72/FF/72/72/72）全部覆盖。
2. **非保护字段**：每帧 `== cfg_frame 写入值`（始终直接生效）。
3. **保护字段，锁定帧（0/1/3/5）**：
   - 输出 `== 复位默认值`（上表期望，参照 pwd_mismatch 检查文件写法）；
   - 层次引用核对存储 `R_REG32_F~R_REG47_F`、`R_REG51/53/54/55/56/57_F` `== 非默认写入值`，证明"存储成功、输出被门控"。
4. **保护字段，解锁帧（2/4/6/7/8）**：输出 `== 该帧写入值`（安全字段非默认跟随；帧 6 安全子集全 1、帧 7/8 归 0 验证逐位可控；敏感字段写默认故输出==默认==存储）。
5. **字节解码**：每帧等待 `ADDR48_F_TEST` 脉冲核对 `DATA_C_TEST` 为该帧 TEST_PRTCT 值，确认 CHPI→0x30 地址解码正确（沿用 `t_8b1lane_TESTO_SEL` 的 `@(posedge WCK1_A)` 等待手法）。
6. **复位默认**：首帧配置前检查 `R_REG48_F==8'h00`、`LSI_PRTECT==0`、各保护输出已处于默认值（复位即锁定）。
7. **防漏检**：维护每帧已检查字段计数器，须等于全字段总数；`get_cfg_val` 直读存储的字段（如 TEST_PRTCT→R_REG48_F、PWRC_CTRL→R_REG31_F）单独补输出侧层次引用比对。
8. **通过条件**：9 次写入全部完成、每帧全字段比对通过、锁定↔解锁共 5 次切换的输出跟随全部验证到、全程 data_merge/digital/analog 无错误。

## 范围与状态

- 运行中不触发 RSTN 复位，复位项仅在仿真起始段检查。
- I2C 写/读路径（含 `REGRD_NOML` 读回掩码）不覆盖，如需要另开 I2C case。
- 锁定帧对敏感字段写非默认值依赖输出门控生效，若 RTL 后续版本改动门控策略导致链路异常，checker 会以 analog/digital 检查错误形式暴露，需回溯区分。

## 实现状态与计划偏差（2026-10-21）

已实现全部代码并登记回归：

- 文件：`cfg_frame0.txt`~`cfg_frame8.txt`、`testprtct_checker.sv`（74 个受保护字段 + 47 个非保护字段全字段检查表）、`cfg_frame_all_checks_chip0_testprtct.sv`（检查流程）、`t_8b1lane_TEST_PRTCT.sv`（vseq+test）、`test_lib.sv`、`test.f`、`user_def.sv`、`waves_dumper.sv`；已登记 `regression/testname.f`。
- 静态交叉验证通过：Python 脚本核对 checker 各期望队列长度一致（各 74 项）且逐字段对齐、9 个 cfg_frame 与期望队列逐字段一致、`tp_get_cfg_val`/`tp_get_cfg_store` 引用的层次信号名均在 `LC_CPUWR.v`/`LINK_CONFIG_CTRL.v`/`LC_REG_MAPPING.v` 中存在。
- 尚未做服务器编译与 DUT 仿真。

与原计划的偏差（RTL 译码核实后调整）：

1. **0x90~0x93 仅 I2C 可写**：`ADDR144_F~ADDR147_F` 仅在 `SPECIAL_ADDR_TEST_EN` 的 I2C 路径置位（`LC_CPUWR.v:654` 起），CHPI CTRL_F 只打包 0x00~0x3F。本 case（纯 CHPI 写）中这 8 个字段（reg_fast_lock_rlpf/icp、reg_fine_lock_rlpf/icp、FSEL、reg_pbs_flt、reg_lock_wd_sel、BCC_M）只验证"输出保持复位默认 + 存储保持默认"，写入跟随需 I2C case 覆盖。
2. **帧 6 "全 1" 仅限监测/偏置安全子集**（TESTO/DC 监测、DCBIAS、BGR 等）：HIZ/SR 类字段（HIZ_SEL、R_CH12/34_HIZ、SRE/SRER/SREF、STR、CVBP_SEPARATE、reg_ana_test_sel 等）置 1 会高阻或扰动链路，解锁帧保持默认，仅在锁定帧写非默认值验证门控。
3. **检查同步**：每帧以 `ADDR48_F_TEST` 写脉冲为锚点核对解码字节，再等下一个 `VS_O` 做全字段比对（写脉冲 + VS_O 串联），替代纯 VS_O 同步以避开首帧竞争。
4. **末尾增加帧 8**（重复帧 7 配置），共 9 次 TEST_PRTCT 写入，验证解锁态可跨帧保持。
