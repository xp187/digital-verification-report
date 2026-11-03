# HIZ_SEL 寄存器验证计划

## 1. 目标与范围

新增独立 case：`t_8b1lane_HIZ_SEL`。通过正常 CHPI 配置和图像数据，验证 `HIZ_SEL` 控制 LD_F=1 时的 POL 翻转电荷分享功能，并检查关闭后的恢复。

主判据为最终数字输出 `CS_DRA_R_O`、`CS_DRA_L_O`、`CS_DRA_ALL_O`；内部信号用于检查选择逻辑及定位问题。已实现本目录 case；完整编译与 DUT 仿真待服务器执行。

## 2. RTL 依据

源码目录：`cmodel/test/HV2A31/HDL/HK1V11_digital_top/seperated_code/`。

- `LC_CPUWR.v`：`HIZ_SEL` 位于 `0x22[0]`，复位值为 0，受 `LSI_PRTECT` 保护；配置 `TEST_PRTCT=0x72` 解锁。
- `LOGIC_CENTER.v`：`R_HIZ_SEL` 作为 `R_CS_by_POL` 传递到 `ANCTL`。
- `ANCTL.v:154`：`LD_F_ECO = LD_F & ~(R_CS_by_POL & POL_SW)`。
- `ANCTL.v:158-159`：当 `LD_F_ECO=1` 或 `LD_W<=FAKE_LD_W_TAR` 时，`HIZ_NRM1/2` 选择 `STB_A/B_FAKE`，否则选择 `STB_A/B`。
- `ANCTL.v:167-179`：`CSMODE=00` 时，电荷分享使能要求 `POL_SW`，且 `CS_EN=CS_SIG & ~LD_F_ECO`。
- `ANCTL.v:183`：`DRA_CS` 还受启动、掉电、VPS、ACS 等条件影响，必须约束这些背景条件。
- `BUFFER_O.v:331-333`：左右输出分别连接 `DRA_CS`，ALL 输出连接 `DRA_CS_ALL`。

## 3. 激励与背景条件

采用 8B/10B、单 lane、3 个有效图像帧，固定图像数据，不依赖 PPM，不使用 I2C，不 force 功能信号。

| 阶段 | HIZ_SEL | LD_F | 目的 |
| --- | --- | --- | --- |
| 0 | 0 | 1 | 关闭基线 |
| 1 | 1 | 1 | POL 翻转窗口内允许电荷分享 |
| 2 | 0 | 1 | 关闭并恢复基线 |

每次 CTRL_F 明确配置 `TEST_PRTCT=0x72`、`CTRLF_CHECKSUM=0101`，避免 checksum 保护导致配置错开生效。固定 `LD_R=5`、`LD_W=22`，并核实实际 `LD_W>FAKE_LD_W_TAR`，否则不能用于区分真实与 FAKE STB 分支。

背景保持 `CSMODE=00`、`XON=1`、`PORSD=1`、`POFF_DRA_AMP=0`、`VPS_EN_1=0`、`ACS_EN=0`。等待启动完成、`CS_START=0`，并确认 `DRA_CS_ACS=0`。背景配置错误或一直不能稳定必须报错，不能无限跳过。

使用正常 POL 配置产生翻转。实现时核对 H4INV/POL2/POL/POLC 的具体配置；必须观测到 `POL_SW && CS_SIG` 的有效重叠。若没有重叠，应报告激励或观测不足，不能判 PASS。

## 4. 检查方法

### 最终电荷分享输出：主判据

在上述背景条件满足且 `LD_F=1` 时，根据阶段计划值计算：

```systemverilog
expected_cs = planned_hiz_sel && POL_SW && CS_SIG;
```

逐采样比较 `CS_DRA_R_O`、`CS_DRA_L_O`、`CS_DRA_ALL_O` 与 `expected_cs`，包含高电平和低电平检查，不允许 X/Z。不能仅比较三个输出彼此相同，也不能把 DUT 的 `DRA_CS` 作为 golden。

- 阶段 0、2：三个输出保持 0。
- 阶段 1：仅在 `POL_SW && CS_SIG` 时为 1，其余时间为 0。
- 阶段 1 必须实际观察到输出高脉冲及恢复低电平，阶段 2 必须确认重新关闭。

### 寄存器与内部逻辑：辅助判据

1. 按阶段计划值检查实际 `R_HIZ_SEL`，并核对 LD_F、LD_W、CSMODE 等背景；实际寄存器值不能替代计划值成为期望来源。
2. 独立计算 `expected_ld_f_eco = !(planned_hiz_sel && POL_SW)`，检查 `LD_F_ECO`。
3. 确认 `LD_W>FAKE_LD_W_TAR` 后，按 `expected_ld_f_eco` 检查 `HIZ_NRM1/2` 的真实/FAKE STB 选择。
4. 记录 `CS_EN`、`DRA_CS`、`DRA_CS_ALL` 辅助定位；主输出失败时打印阶段、配置、POL_SW、CS_SIG、启动及覆盖条件。
5. 阶段 1 必须出现被选择的真实 STB 与 FAKE STB 不同的样本，确保分支检查具有区分度。

### 采样与阶段边界

- 按 0→1→0 的顺序识别三次配置生效；不能用配置值首次匹配来识别恢复阶段。
- CTRL_F 可能在可见帧边界前生效，以实际配置提交事件为锚点；丢弃跨提交的行及首个稳定准备行，不能继续使用旧阶段期望。
- 在相关时序更新及 `FF_DLY`、组合逻辑稳定后采样。实现时核对 RTL 时钟与延迟，不直接假设 `#1ps` 足够。
- 仅统计稳定有效行。每阶段至少 3 条有效行；阶段 1 至少 3 条包含 `POL_SW && CS_SIG` 的有效行。阶段等待和整个 case 均需有超时上限。

## 5. 通过标准

- 三个阶段全部按序完成，每阶段有效行数满足要求。
- 实际寄存器和背景条件符合计划；最终三个输出与独立期望逐采样一致。
- 内部 LD_F_ECO、HIZ_NRM1/2 检查零错误，真实/FAKE 分支有区分样本。
- 阶段 1 有至少 3 条有效电荷分享行及高低电平覆盖；阶段 2 恢复关闭。
- 无配置超时、观测不足或 X/Z；任一辅助检查失败也禁止输出 PASS。

## 6. 交付与待验证项

后续实现采用简洁的 test、CHPI 配置和被动 checker，沿用项目现有目录格式。优先输出清楚的错误现场与阶段计数，不增加无关测试框架。

本 case 不覆盖模拟电压、电荷均衡效果、CSMODE 全组合、ACS/VPS 功能、FAKE 阈值扫描及 LD_F=0 的完整回归。这些功能需要各自专项测试。

当前状态：已对照本地 RTL 制定计划；具体 POL 激励、采样时刻及完整 CHPI/UVM 行为仍需在实现和服务器仿真中确认。

## 7. 实现记录

已生成 test、常量图像 sequence、被动 checker、4份 cfg、逐行 POL 覆盖文件、编译入口及波形入口，并登记 regression/testname.f。主判据直接检查 digital_top 三个最终 CS_DRA 输出；0x22 使用 DATA_D_TEST[0] 跟踪写入。具体激励采用各阶段逐行 POL=0/1 交替。采样在 ANCTL.CLK 下降沿后等待 FF_DLY+1ps；写入后等待 VS，并跳过两个 K1 边界，统计完整有效行。第四次写入为尾帧重复0，不作为第四阶段。

本地静态检查与语法解析结果见 README.md；完整 UVM/CHPI/DUT 编译仿真仍待服务器确认，不能将代码完成视为功能已通过。

## 8. 新版 HDL 层次适配

依据更新后的 `HDL/file_list/HK1V11_digital_top.f`：顶层使用 `HDL/TOP/HK1V11_digital_top.v`，内部使用 `HDL/HK1V11_digital_top/LOGIC_CENTER.f` 所列文件。顶层仅暴露 `DRA_CS`，由 `u_LOGIC_CENTER.CS_DRA_L_O` 连接；R/ALL在该封装层留空。checker保留三路独立期望比较，观测点改为 `u_LOGIC_CENTER.CS_DRA_*_O`，并新增真正顶层 `DRA_CS` 检查。新版ANCTL新增smart-CS的STB选择，但本case固定CSMODE=00，该旁路不启用。其余当前引用的内部信号名已按新版核对。服务器需重新编译仿真。

## 9. 精简发送结构

删除额外的base_vseq派生包装，将常量图像发送类并入 `t_8b1lane_HIZ_SEL.sv`，由test直接启动物理TX sequencer；删除单独的hiz_sel_sequence.sv。发送内容、三帧配置与checker判据保持原样；消除无参base_vseq构造函数误传name引起的TMAFTC编译错误。后续使用_v3.py安装器，旧版本安装器同步更新，安装时清理旧sequence文件。
