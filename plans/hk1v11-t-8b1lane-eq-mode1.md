# EQ_MODE=1 软件 lane 设置验证计划

## 验证目标

在 `AUTO_EQ_EN=0`、`EQ_MODE=1`、`reg_pin_eq=0` 条件下，通过 CHPI 更新 `sw_reg_lane_ctrl[4:0]`，确认数字顶层 `reg_lane_ctrl[4:0]` 跟随软件值，并且不受外部 `EQ[2:0]` 引脚变化影响。

用户已确认以当前 RTL 为依据。`LC_REG_MAPPING.v` 中软件选择条件为 `reg_pin_eq | EQ_MODE`，所以 `EQ_MODE=1` 时应选择软件设置。期望值来自本计划的写入数据，运行时不反读 DUT 内部译码结果。

## 前置条件

- 在第一次 CHPI 配置写入前设置 `chip_tb_top.eq_mode_pin=1`、`chip_tb_top.aeq_pin=0`，并保持到全部检查结束。所有软件写入均发生在 `EQ_MODE=1` 期间。
- 每帧通过 CHPI 写 `reg_pin_eq=0`（`0x33[7]`）。
- 固定 `PORSD=1`、`TEST_PRTCT=0x72`、`CTRLF_CHECKSUM=0101`。其中 `0101` 用于关闭三帧 checksum 校验等待。
- 沿用单 lane、12 ports、3840×16、8 帧配置。
- 通过现有 TB 变量驱动引脚，变量经过连续赋值驱动 wire，再连接芯片封装层 inout 端口。

## 配置地址与激励

五个软件位分布如下：`sw_reg_lane_ctrl4/3` 位于 `0x02[1:0]`，`sw_reg_lane_ctrl2/1` 位于 `0x03[1:0]`，`sw_reg_lane_ctrl0` 位于 `0x04[0]`。

| 帧 | 写入 `sw_reg_lane_ctrl[4:0]` | `EQ[2:0]` 引脚 | 期望 `reg_lane_ctrl[4:0]` | 检查目的 |
| ---: | :---: | :---: | :---: | --- |
| 0 | `00000` | `000` | `00000` | 软件全 0 |
| 1 | `11111` | `111` | `11111` | 五位全部置 1 |
| 2 | `00001` | `000` | `00001` | bit0，其他位清零 |
| 3 | `00010` | `111` | `00010` | bit1 |
| 4 | `00100` | `000` | `00100` | bit2 |
| 5 | `01000` | `111` | `01000` | bit3 |
| 6 | `10000` | `000` | `10000` | bit4 |
| 7 | `00000` | `111` | `00000` | 最后清零 |

`cfg_frame0.txt` 至 `cfg_frame7.txt` 实现上述配置；`cfg_frame8.txt` 重复最后一帧，供基础发送流程使用。EQ 引脚对应的 pin 模式译码值与本表软件期望不同，错误选择 pin 路径时应产生失配。

## Checker 与通过条件

复用现有基础发帧流程，发送与 checker 并行运行。每个观察帧的 `VS_O` 上升沿设置本表对应的 `eq_pin`，等待 `1ns` 后，对以下五位信号进行一次严格比较：

```text
chip_tb_top.u_HK1V11.u_HK1V11_digital_top.u_LOGIC_CENTER.reg_lane_ctrl[4:0]
```

期望值直接使用本表的 CHPI 软件写入值。checker 只需一个 8 次循环、一张固定期望表和一次 `!==` 比较。失配报告帧号、EQ 引脚、实际值和期望值。首个有效 `VS_O` 与初始 CTRL_F 配置生效的对应关系需在目标仿真确认。

8 帧全部比较完成且无失配即通过，用数字顶层输出变化验证软件写入及软件路径选择生效。主测试持有 objection，等待发送与检查结束；缺帧使用既有仿真总超时。

## 文件规划与范围

- `t_8b1lane_EQ_MODE1.sv`：test/vseq，配置环境、设置模式引脚，协调发送与检查。
- `eq_mode1_checker.sv`：固定期望表及精简比较循环。
- `cfg_frame0.txt` 至 `cfg_frame8.txt`：逐帧配置和结束配置。
- `user_def.sv`、`test_lib.sv`、`test.f`、`waves_dumper.sv`：沿用工程格式。
- 独立生成脚本 `generate_t_8b1lane_EQ_MODE1.py` 兼容 Python 3.9，内嵌所有文件；支持从top或tests运行，以及`--dv-top`指定工程。按需升级TB的变量驱动wire连接并登记回归；不生成 PPM 或 `ctrl_l_line_cfg.txt`。

本 case 不覆盖自动 EQ、checksum 保护功能或其他选择模式。已生成case、配置和独立安装脚本。通用数据/数字/模拟/chopper scoreboard关闭，本case通过专用五位checker判断。尚未进行完整 DUT 编译和仿真。
