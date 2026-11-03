# HIZ_MIN_SEL / HIZ_MIN_VAL 验证计划

## 目标与依据

用一个联合 case 验证 `HIZ_MIN_SEL` 的选择功能和 `HIZ_MIN_VAL` 的手动高阻间隔。两个字段位于地址 `0x2F`：`HIZ_MIN_SEL` 为 bit 1，`HIZ_MIN_VAL` 为 bits [6:2]，写入生效需要 `TEST_PRTCT=0x72`。规格规定在 `TP_F_AHEAD=1` 且 `LD_F=1` 时，手动高阻间隔为 `HIZ_MIN_VAL × 4 + 4 packet`。

RTL 中，`CHPI_SD_CTRL` 用 `HIZ_MIN_SEL` 选择 `HIZ_MIN_VAL` 或自动阈值，并由该阈值生成 `STB_A_FAKE/STB_B_FAKE`；`ANCTL` 在 `LD_F=1` 时选择 FAKE 高阻路径。因此本 case 以实际输出变化为判定依据，不把寄存器读回当作功能通过。

参考：`LC_CPUWR.v:524-526`、`CHPI_SD_CTRL.v:188-211,444-451`、`ANCTL.v:154-162`。现有 `t_8b1lane_TP_F_AHEAD` 只覆盖 `LD_F=0`、`HIZ_MIN_SEL=0`，本 case 独立验证 `LD_F=1` 的手动设置。

## 激励配置

- 沿用 8b1lane 基础发送流程；每帧一次写入该帧全部配置。保持 `TEST_PRTCT=0x72`、`TP_F_AHEAD=1`、`LD_F=1`、`LD_W=32`，并固定其他会影响输出时序或高阻状态的配置。保持正常解锁与输出使能。
- 每组至少一整帧、16 条活动行；只用配置稳定后的活动行做宽度比较。末尾再发送一帧与 G 相同的配置，保证 G 的最后一帧数据完整结束。

| 组别 | `HIZ_MIN_SEL` | `HIZ_MIN_VAL` | 预期与目的 |
| --- | ---: | ---: | --- |
| A | 0 | 0 | 自动间隔基准 |
| B | 0 | 31 | 应与 A 相同，证明 SEL=0 时 VAL 被忽略 |
| C | 1 | 0 | 手动间隔 4 packet，检查下边界 |
| D | 1 | 1 | 手动间隔 8 packet，检查相邻值 |
| E | 1 | 10 | 手动间隔 44 packet，检查中间值 |
| F | 1 | 31 | 手动间隔 128 packet，检查上边界 |
| G | 0 | 31 | 应恢复 A 的自动间隔，检查 SEL 重新关闭 |

`0x2F` 每帧写入的字段组合为 `(HIZ_MIN_VAL << 2) | (HIZ_MIN_SEL << 1)`；保留位和本 case 不测的 bit 7 均为 0。`cfg_frame7` 重复 G；A～G 对应 `cfg_frame0`～`cfg_frame6`。

## Checker 观测与判定

1. 在每条待检查活动行确认 `TP_F_AHEAD=1`、`LD_F=1`、`HIZ_MIN_SEL/HIZ_MIN_VAL` 与该帧预期一致；配置尚在帧交接中变化的行不用于宽度判定。
2. 记录 `STB_A_FAKE` 上升、下降边沿，计算脉宽。手动模式期望由 `VAL × 4 + 4 packet` 换算，不能用当前 DUT 的 `FAKE_LD_W_TAR` 作为期望值。A、B、G 的实测宽度应相同，并核对自动模式的规格期望。
3. 同时观察 `u_LOGIC_CENTER.POL1A/POL1B`：FAKE 高阻期间两路应同时关闭；高阻结束后恢复正常互补输出。服务器实际 `digital_top` 不包含最初假定的 `POL1A_DRA_L_O` 端口，因此checker使用 `LOGIC_CENTER` 中已有的输出信号；`ANCTL.HIZ_NRM1` 只用于定位问题，不作为通过判据。
4. 每组统计至少一条配置稳定且完成比较的有效行；报错打印组别、帧号、行号、SEL、VAL、实测间隔和期望间隔。整个 case 有超时和完成计数，避免没有采到输出却误报通过。

## 编码前需核对的时间基准

规格以 packet 表示高阻间隔，RTL 用 DCLK 计数且输出经半周期寄存器。实现 checker 前，需从 `STB_A_FAKE` 与顶层 POL 的实际边沿确认 packet↔DCLK 换算、起止边沿及固定延迟。RTL 的自动阈值还依赖 `TP_falling_ahead_cycle`，因此自动模式不能写死一个 DCLK 常数；应结合规格默认最小值和实际频率计算期望。若规格值与 RTL 边沿定义不一致，先记录差异再确定最终断言。

## 文件与验证

本目录现已生成 `cfg_frame0.txt`～`cfg_frame7.txt`、UVM test、checker 和编译入口；可写工程根目录的 `generate_t_8b1lane_HIZ_MIN.py` 可重新生成。生成器不处理 PPM。代码按当前 RTL 将手动模式期望换算为 `2 × (VAL + 1) DCLK`，自动模式按实时提前周期计算为 `2 × (11 + TP_falling_ahead_cycle) DCLK`。本地 Icarus 隔离激励验证了120条通过，以及故意加长1 DCLK时准确报错；修改观测层级后的服务器UVM编译和DUT仿真仍待确认。
