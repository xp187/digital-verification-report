# CG_OFF 时钟门控常开功能验证计划

## 1. 依据与目标

- 寄存器 `0x33[0] CG_OFF`（`R_REG51_F[0]`，复位默认 0，`N_RST_NLOCK` 域），RTL 权威定义在 `LC_CPUWR.v:574`：
  `assign CG_OFF = LSI_PRTECT ? R_REG51_F[0] : 1'b0;`，为 TEST_PRTCT 受保护字段。
- 唯一生效的使用点在 `CHPI_CONFIG_L0.v:74`：`CONFIG_CLK_REQ = CONFIG_ACTIVE | R_CG_OFF;`，
  经 `CLKGEN.v:175` 门控出配置写时钟 `DCLK_CONFIG_GATED`，即 `WCK1_A` / `WCK1_A_CHPI`。
- 功能定义：`CG_OFF=1` 时配置写时钟在无传输期间保持自由运行（时钟门控常开）；`=0` 时仅在有
  配置包传输（`CONFIG_ACTIVE=1`）期间振荡。正常地址 0 保持 idle，自由时钟不得引发寄存器误写。
- 本 case 只验证 CG_OFF 的时钟门控功能与配置通路安全性。`TEST_PRTCT` 仅作为解锁前提在每帧
  固定写 `0x72`（同 `t_8b1lane_LD_D_OPT` 的固定写法），其锁定/边界行为由
  `t_8b1lane_TEST_PRTCT` 覆盖，本 case 不重复。同字节其余位（`reg_lane_ck_inv_en` 等）不测。

## 2. Case 与配置

新 case `t_8b1lane_CG_OFF`，全 CHPI 配置帧写路径（不用 I2C），使用公共图像发送 sequence，需要正常 pattern 文件。
`FRAME_NUM=5`，`CHIP_SEL=0`，`TEST_EN=0`（保证 `WCK1_A` 走 `DCLK_CONFIG_GATED` 而非 `T_REGLD`）。

固定项：`CTRLF_CHECKSUM=0101`、`POL 0`、`PORSD 1`、常规行配置；每帧变化仅 `CG_OFF`。
检查从训练完成、`cfg_frame0` 生效后开始，复位/训练阶段的时钟行为不在统计范围内。

| 帧 | CG_OFF | 本帧检查 |
| ---: | :---: | --- |
| 0 | 0 | 基线：空闲窗口 `WCK1_A_CHPI` 无上升沿，`CONFIG_CLK_REQ` 仅传输时为高 |
| 1 | 1 | 主判据：空闲窗口时钟自由运行，`CONFIG_CLK_REQ` 常高，`CG_OFF` 输出=1 |
| 2 | 0 | 关→开→关可逆恢复（对帧 0 基线一致） |
| 3 | 1 | 功能安全性：自由时钟下写 `sw_reg_lane_ctrl=01010` 并核对输出，且全帧无误写 |
| 4 | 0 | 收尾恢复门控（对帧 0 基线一致） |

`cfg_frame0` 训练后立即发送，`cfg_frame1..4` 在前一图像帧最后一个 VACT 行末发送（公共 `isptx_sequence.send_ppm`）。

## 3. Checker 设计与判定

被动 checker 随 test `include`，逐 DCLK 周期采样，按帧（以本帧 CTRL_F 写脉冲锚点 + 下一
`VS_O` 圈定生效帧，同 TEST_PRTCT case 时序模型）统计：

1. **配置生效**：确认 `CG_OFF` 输出等于本档值、存储 `R_REG51_F[0]` 等于写入值、
   `LSI_PRTECT=1`、`TEST_EN=0`。配置不符不计入通过数。
2. **主判据（时钟门控）**：逐周期跟踪 `CONFIG_ACTIVE`，只在连续无传输间隙
    （`CONFIG_ACTIVE=0` 持续 ≥16 个 DCLK）内，先跳过入口两个 DCLK 采样点，
    让最后一个有效配置脉冲结束，再统计 `WCK1_A_CHPI` 上升沿及有效空闲周期数：
   - `CG_OFF=0` 帧：间隙内沿数必须为 0；
   - `CG_OFF=1` 帧：沿数应接近间隙 DCLK 数的一半（自由运行），且 `CONFIG_CLK_REQ` 恒 1；
   - 同时记录本帧累计的空闲间隙总时长，间隙不足（如全部被配置包占满）时报告观测不足，
     不得默认通过。
   注意 `isptx_sequence` 每条活动行/消隐行都发 CTRL_L，`CONFIG_ACTIVE` 频繁拉高，
   必须以实测间隙为准，不能假设帧内某固定时段空闲。
3. **误写安全（每帧）**：`CG_OFF=1` 期间抽查若干无副作用的输出字段
   （如 `sw_reg_lane_ctrl`、`R_LD_R`、`R_CH_SEL` 等）与写前期望一致；帧 3 另核对
   自由时钟下新写入的 `sw_reg_lane_ctrl=01010` 已正确出现在
   `digital_top reg_lane_ctrl[4:0]`。发现任何非本帧写入引起的输出变化即报错。
4. **完成条件**：5 档全部完成且主判据、可逆性、误写安全均无错误；设独立进度计数与总超时。

## 4. RTL 定位辅助

波形建议保留：CTRL_F 0x33 写入、`R_REG51_F[0]`、`CG_OFF`（LC_CPUWR 输出）、
`CONFIG_ACTIVE`、`CONFIG_CLK_REQ`、`DCLK_CONFIG_GATED`/`WCK1_A_CHPI`、`VS_O`。
`CHPI_SD_CTRL.v` 中两处引用 `R_CG_OFF` 的 `CG_CELL` 已被注释、`CHPI_SCR_DEC_L0.v` 的
同名端口悬空，属历史残留，不作为判据也不作为失败依据。

## 5. 验证状态

计划已实现为 case：`user_def.sv`（FRAME_NUM=5、CHIP_SEL=0、TEST_EN 由环境默认 0）、
`cfg_frame0..4.txt`（每帧全字段，TEST_PRTCT 固定 0x72，CG_OFF=0/1/0/1/0，帧 3 另写
sw_reg_lane_ctrl3/1=1 即 01010）、`cg_off_checker.sv`（写脉冲锚定 `ADDR51_F_TEST` +
`DATA_C_TEST[0]`；`cg_check_config` 查 LSI_PRTECT/TEST_EN/输出与存储/软件分支选择；
`cg_measure_window` 以 `CG_CC.DCLK` 为时基在 4000 周期窗口内按 `CONFIG_ACTIVE==0`
≥16 周期间隙跳过入口两个 DCLK 采样后统计 `WCK1_A_CHPI` 上升沿，`CONFIG_CLK_REQ` 仍检查全部空闲采样；CG_OFF=0 帧 0 沿、
=1 帧 ≥空闲/4，空闲 <2000 周期或间隙 <5 报观测不足；`cg_miswrite_spot` 抽查
R_LD_R/R_CH_SEL/sw 存储位与 reg_lane_ctrl 期望 01010@帧3）、`t_8b1lane_CG_OFF.sv`
（vseq+test，main_phase fork watchdog 10ms/check_flow join_any+disable fork+
cg_final_report）、`test_lib.sv`、`test.f`、`waves_dumper.sv`。
已登记 `regression/testname.f`。完成静态核对（cfg 字段值、checker 层次信号名与
LC_CPUWR/LINK_CONFIG_CTRL/CHPI_CONFIG_L0/LC_REG_MAPPING 对照、文件清单、LF 无 BOM）；
未做 SV/UVM 编译和 DUT 仿真。空闲窗口密度、门控关断时的残留电平和自由时钟下的
实际沿频率须服务器仿真确认。

2026-10-22：按服务器波形修复空闲入口边界计数。独立 Icarus 测试直接提取
`cg_measure_window`：旧逻辑复现 47 个间隙各误计 1 沿；新逻辑正常边界 0 错误，
空闲额外沿和常开模式停钟仍能报错，常开正常时钟通过。该结果仅覆盖 checker
测量任务，不代表完整 UVM/DUT 仿真通过；服务器仍需重跑本 case。

第二轮波形显示下一档 CG_OFF 在当前测量尚未结束时写入。原 20000 DCLK
约 134 us，超过 VS 后约 46 us 的当前配置有效窗口，导致旧期望误报并漏掉
下一次 0x33 写脉冲。窗口缩短为 4000 DCLK（约 27 us），在下一 CTRL_F
前完成测量和寄存器抽查，仍要求至少 2000 有效空闲周期及 5 段合格间隙。
