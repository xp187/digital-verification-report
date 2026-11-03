# `reg_pin_eq=0` EQ 引脚模式验证计划

## 验证目标

在 `AUTO_EQ_EN=0`、`EQ_MODE=0`、`reg_pin_eq=0` 时，确认数字输出 `reg_lane_ctrl[4:0]` 由外部 `EQ[2:0]` 引脚译码产生，并且不受软件配置 `sw_reg_lane_ctrl[4:0]` 影响。

## 前置条件与激励

- 全程保持 `AUTO_EQ_EN=0`、`EQ_MODE=0`。TB 使用默认值为 0 的 `aeq_pin`、`eq_mode_pin` 通过连续赋值驱动 `eq_pad`、`eq_mode_pad`、`aeq_pad` 三个wire网络，连接芯片封装层inout引脚；case 通过 `chip_tb_top.eq_pin[2:0]` 设置 EQ 输入，无需 force。单颗及 MULTI_CHIP 的四颗实例共用这三个变量。
- 每帧通过 CHPI 将 `reg_pin_eq`（`0x33[7]`）写为 0。
- 共 8 帧，`EQ[2:0]` 从 `000` 遍历到 `111`。软件 `sw_reg_lane_ctrl[4:0]` 在 `00000` 和 `11111` 间交替，确认 pin 模式下输出不跟随软件值。
- 每个观察帧的 `VS_O` 上升沿设置对应 EQ 输入，等待 `1ns` 后采样，并保持到下一观察帧。首个有效 `VS_O` 与初始 `CTRL_F` 配置的对应关系需在目标仿真中确认。

| 帧 | `EQ[2:0]` 引脚值 | `sw_reg_lane_ctrl[4:0]` | `reg_lane_ctrl[4:0]` 期望值 |
| ---: | ---: | ---: | --- |
| 0 | `000` | `00000` | `00010` |
| 1 | `001` | `11111` | `10100` |
| 2 | `010` | `00000` | `01011` |
| 3 | `011` | `11111` | `10111` |
| 4 | `100` | `00000` | `00010` |
| 5 | `101` | `11111` | `10100` |
| 6 | `110` | `00000` | `01011` |
| 7 | `111` | `11111` | `10111` |

## Checker 与通过条件

每个观察点只比较一次五位信号：`chip_tb_top.u_HK1V11.u_HK1V11_digital_top.u_LOGIC_CENTER.reg_lane_ctrl[4:0]` 与固定期望表。失配时报告帧号、EQ 输入、实际值和期望值。8 种 EQ 输入均采样且比较通过，即本 case 通过。

## 期望值依据

用户已确认以当前 RTL 为准。以上固定期望表依据 `cmodel/test/HV2A31/HK1V11_digital_top/seperated_code/LC_REG_MAPPING.v` 的译码，已经考虑 `{EQ[0], EQ[1], EQ[2]}` 与外部 `EQ[2:0]` 的位序关系；运行时直接比较固定常量，不反读 DUT 内部译码结果。寄存器资料中的位宽与编码差异作为已知文档差异保留。

现有配置中的 `CTRLF_CHECKSUM=0101` 用于关闭三帧 checksum 等待。本 case 不检查错误 checksum 拒绝或 checksum 保护功能。

## 不在本 case 范围内

不检查 `reg_pin_eq=1`、`EQ_MODE=1`、自动 EQ 行为或错误 checksum 处理。

## 实现与交付

- `t_8b1lane_reg_pin_eq0.sv`：test/vseq，复用基础发帧，显式并行启动发送与checker，并等待两者结束。
- `eq_pin_checker.sv`：8次循环、固定期望表和一次五位严格比较；逐帧报告PASS或失配信息。
- `cfg_frame0.txt`至`cfg_frame7.txt`：上述8帧软件值配置；`cfg_frame8.txt`重复末帧，供发送流程使用。
- `user_def.sv`：单lane、12 ports、3840×16、8帧。通用数据/数字/模拟/chopper scoreboard关闭，本case只判断EQ控制输出。
- 独立生成器 `generate_t_8b1lane_reg_pin_eq0_inout_fix.py`：兼容Python 3.9，可从工程根目录或tests目录运行，也支持`--dv-top`。生成case、连接TB变量并登记回归；不生成PPM或`ctrl_l_line_cfg.txt`。

已完成代码与安装脚本生成；完整DUT编译和仿真待目标环境运行。
