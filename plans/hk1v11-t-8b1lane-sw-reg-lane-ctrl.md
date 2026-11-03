# sw_reg_lane_ctrl 数字侧验证计划

## 目标与依据

验证 CHPI 写入五个 `sw_reg_lane_ctrl` 位后，`digital_top.reg_lane_ctrl[4:0]` 按选择条件输出正确值。五个位分布在 `0x02[1:0]`（bit4、3）、`0x03[1:0]`（bit2、1）和 `0x04[0]`（bit0）；`0x33[7] reg_pin_eq` 选择软件值或 EQ 引脚预设。本 case 只判断数字控制输出，不以模拟均衡增益或图像数据作为通过条件。

寄存器说明规定 `reg_pin_eq=1` 时使用软件值。当前参考 RTL 的优先级为 `AUTO_EQ_EN`、`reg_pin_eq | EQ_MODE`、EQ 引脚译码。现有 testbench 固定 `EQ=3'b000`、`EQ_MODE=0`，因此选择 EQ 引脚时预期输出为 `5'b00010`。`AUTO_EQ_EN` 来自 `AEQ` 引脚，而当前 TB 的 `.AEQ()` 未连接。case 在发帧前将 `chip_tb_top.u_HK1V11.AEQ` 固定为 0，使 `AUTO_EQ_EN=0`。

## 激励与期望

复用 `t_8b1lane` 基础发帧流程，以 8 帧配置覆盖 EQ 引脚基线、软件全0、五个位的 walking-one，以及 EQ 引脚选择时软件全1的覆盖场景。每帧固定 `CHIP_SEL=0`、单 lane、12 ports、活动区 3840×16、`PORSD=1`、`TEST_PRTCT=0x72`，并设置 `CTRLF_CHECKSUM=0101` 使 CTRL_F 配置帧通过 checksum 保护。

| 帧 | `reg_pin_eq` | 五位软件值 | `reg_lane_ctrl[4:0]` 期望 | 检查点 |
| --- | ---: | ---: | ---: | --- |
| 0 | 0 | `00000` | `00010` | EQ 引脚基线 |
| 1 | 1 | `00000` | `00000` | 软件全0 |
| 2–6 | 1 | `00001` 至 `10000` | 与软件值相同 | 逐位 walking-one |
| 7 | 0 | `11111` | `00010` | EQ 引脚选择覆盖软件值 |

`cfg_frame8` 重复 frame7，作为结束保护配置。

## Checker 与通过条件

每帧在 `VS_O` 上升沿后 1 ns 检查一次 `chip_tb_top.u_HK1V11.u_HK1V11_digital_top.u_LOGIC_CENTER.reg_lane_ctrl[4:0]`。checker 只用八个固定期望值和一次五位 `!==` 比较；失配报告帧号、实测值及期望值。采齐 8 帧且无失配即通过。期望值来自本计划的配置与 EQ 引脚选择，不从内部寄存器映射反读。

通用数据 scoreboard 仅作为传输 smoke check。缺帧使用仿真总超时，不增加额外状态机或逐位 checker。

## 范围与状态

不检查寄存器回读、写入被拒绝、`0xA1[4]` 只读访问、模拟增益或自动均衡功能。`reg_pin_eq=0` 帧只检查输出选择，不判断软件位是否存储。

case 已生成；尚未编译或运行 DUT 仿真，需在目标仿真中确认帧采样时刻和 AEQ force 层级。
