# UTC_long01_frame[1:0] 验证计划

## 1. 目标与依据

- 被测字段：CTRL_F `0x38[1:0] UTC_long01_frame[1:0]`，本 case 使用 `CHIP_SEL=0`、413b/420b 长编码路径。寄存器表将其描述为 DE 区 long frame 累计错误门限；复位配置为 `2'b01`。
- 发送端参考 `t_8b1lane_UTC_HEADER_CNT` 的私有 420b 注错方法和 `t_8b1lane_UTC_HEADER_FRAME` 的两帧边界、K4 清零及失锁后重新训练结构。预期行为以寄存器说明为目标，四档数值及精确计数单位按当前 RTL 映射确定。
- `LONG_ENCODING_ERROR_CTRL.v` 的 `LONG01_HIT_0/1/2` 在对应 `RAW_VLD` 有效、`RAW_IDX != 0` 且 7-bit 原始码字等于 `7'h00` 或 `7'h7f` 时为 1；`LONG01_INC` 是同一 DCLK 三路 HIT 的和，可能为 0～3。`LONG01_ERROR_FRAME_CNT` 按命中组数累加，并非按行数或时钟周期数累加。
- 未达到门限时，`K4_FIND`、UTC 检测关闭或失锁复位使计数清零；达到门限后 `LONG01_ERROR_FRAME` 的保持分支优先于 K4。长编码路径的 `UTC_FRM_ERR = HEADER_ERROR_FRAME | LONG01_ERROR_FRAME`，触发后接收 PHY 可能失锁。
- RTL 依据：`E:\projects\HK1V11_top_1012\cmodel\test\HV2A31\HDL\HK1V11_digital_top\long_encoding\LONG_ENCODING_ERROR_CTRL.v`、`seperated_code/LC_CHPI_DECODE.v`、`rx_phy/rx_phy_unit_flag_gen.v`。发送端编码依据 `top/agents/isprx_env/isptx_agent/long_encoding_ref_model.sv`。

| `UTC_long01_frame` | 门限 T | Frame 0 / Frame 1 的 T−1 行分配 | Frame 1 第 T 次 |
|---|---:|---|---|
| `00` | 4 | `3` | 下一行 `1` |
| `01` | 8 | `7` | 下一行 `1` |
| `10` | 16 | `7+7+1` | 下一行 `1` |
| `11` | 32 | `7+7+7+7+3` | 下一行 `1` |

每个数字是一条 active line 中注入的非法 7-bit 数据组数；每行最多 7 组，分散到不同的完整 420b block。`VACT=16` 足以容纳最大门限的前缀行、触发行和后续无错行。

## 2. Case 组织和配置

- 规划一个 `t_8b1lane_UTC_LONG01_FRAME`，一次仿真按 `00 → 01 → 10 → 11` 顺序遍历四档。每档从正常 link training 和 CTRL_F 配置开始，使用完整 VBP/VACT/VFP、正常行时间和两帧发送；前一档达到门限导致失锁后，等待失锁完成，再启动下一档 TX sequence 重新训练。四档共需 8 个目标帧，不用额外运行参数。
- 复用现有 3840×16、12-port、`CHPI_MODE_420B` 背景；`FRAME_NUM=2` 是每档 TX sequence 的帧数。由 virtual sequence 在每档开始前写该档 `cfg_frame0/1/2.txt`，再由正常 `get_ctrlF_reg()` 和 `send_420b_ctrl_f_line()` 编码发送；每档三个文件保持相同字段值。不修改 `env_cfg.sv`，不生成 PPM，像素队列直接填固定正常数据。
- 固定 `UTC_header_cnt=11`、`UTC_header_frame=111`，保持 header toggle/tag 正常，让 `HEADER_ERROR_LINE`、`HEADER_MISMATCH_ERROR`、`HEADER_ERROR_FRAME` 均为 0。`SCREN=0`、`PORSD=1`、`CH_SEL=001`、`TEST_PRTCT=0x72`。非 FPGA 仿真沿用已有 case 的 `UTC_ENB_I=0` 检测使能条件，并检查 DUT 实际 `N_UTC_ENB=1`。不 force 计数器、错误标志、PHY 锁或失锁输出。

## 3. 注错位置与数量

1. 先用现有 `long_encoding_ref_model.encode_with_70b_alignment()` 正常编码一条 active line，形成 `enc_bits[$]`；保持 K1、K2、20-bit packet 数量、420b block header 和块末 bit 原样。
2. 从第 2 个完整 block 起，每个目标 block 选择内部 payload group 10（`RAW_IDX != 0`，避开 header、首末 payload 组）。用 `block*420 + 7 + 10*7` 定位该组 7 个发线 bit，整组改为 `7'h00` 或 `7'h7f`。当前编码器无替换时使用保留 header tag 0/63；非保留 tag 为 1～62，因此注入码字的低 6 bit 不会误配非保留 tag。若可用完整 block 不足，报激励无效，不计覆盖。
3. 一条目标行使用不同完整 block 注入 1～7 组；注入前断言可用 block 数足够。按注错序号交替使用 `00` 与 `7f`，确保每档两种非法码字均被送出。不得修改 420b header toggle bit，以隔离 `UTC_header_frame` 路径。
4. 发送端记录计划注错数；checker 从 DUT 侧核对 `LONG01_ERROR_FRAME_CNT` 的实际增量。`LONG01_INC` 和三路 `LONG01_HIT` 纳入波形，以便定位漏计或一拍多计。不能仅凭发送端计划数量宣布通过。

## 4. 每档两帧流程和检查点

**Frame 0：T−1 与 K4 清零。** 在第一条注错行前检查 DUT 生效 `UTC_LONG01_FRAME`、`N_UTC_ENB`、计数 0 及各错误标志 0。按表逐行注入，总计 T−1；每条目标行传完后比较累计计数，证明中间的 K1 没有清除帧计数。剩余 active line 不注错并确认计数保持 T−1、`LONG01_ERROR_FRAME=0`、`UTC_FRM_ERR=0`。在 VFP 正常 CTRL_F/K4 后等待寄存器时序稳定，检查计数回到 0。

**Frame 1：T−1/T 边界。** 再次逐行注入 T−1 并检查各行累计值和帧错误标志仍为 0。下一条 active line 只注入 1 组；在 `LONG01_ERROR_FRAME` 上升沿附近及时采样，检查计数恰为 T、`LONG01_ERROR_FRAME=1`、`UTC_FRM_ERR=1`。同时要求 `HEADER_ERROR_FRAME_CNT=0`、`HEADER_ERROR_FRAME=0`、`HEADER_ERROR_LINE=0`、`HEADER_MISMATCH_ERROR=0`、`UTC_ERR=0`，证明触发来自 long01 路径。任何 X/Z、漏计或提前触发均报错。

第 T 次可能紧接着使接收端失锁，不能等完整行结束才首次观察帧错误。触发前启动 watcher，在标志上升时捕获计数和标志；随后结束本档 TX，等待真实失锁，再用正常训练进入下一档。下一档首帧的计数必须从 0 开始；若无法重新 lock 或无有效触发样本，整 case 不通过。门限后的 K4 清零不是期望，因为当前 RTL 达门限后先进入保持分支。

## 5. Checker、覆盖和证据

- checker 独立放一个简短文件，提供四档门限查表、逐行 `check_state(frame, row, cfg, expected_count, expected_flag)` 和第 T 次 `watch_trigger()`。用 `!==` 比较实际生效字段、计数、`LONG01_ERROR_FRAME`、`UTC_FRM_ERR` 及隔离标志；日志包含档位、帧号、行号、`00/7f` 注错数和实测计数，失败时打印期望值。case 通过 `include` 使用 checker。
- 每档必须记录：配置生效、`00` 命中、`7f` 命中、Frame 0 的 T−1 不触发、K4 清零、Frame 1 的 T−1 不触发、第 T 次触发；四档均完成才算门限覆盖。可用轻量数组/日志记录，不需要复杂 coverage 架构。
- 波形至少保留 `UTC_LONG01_FRAME`、`N_UTC_ENB`、`RAW_VLD_0/1/2`、`RAW_IDX_0/1/2`、`RAW_7B_0/1/2`、`LONG01_HIT_0/1/2`、`LONG01_INC`、`LONG01_ERROR_FRAME_CNT`、`LONG01_ERROR_FRAME`、`HEADER_ERROR_FRAME_CNT`、`HEADER_ERROR_FRAME`、`UTC_ERR`、`UTC_FRM_ERR`、`K1_FIND`、`K4_FIND`、`N_RST_NLOCK` 和 PHY 锁状态。

## 6. 规范边界与后续负向场景

- 寄存器表注明“仅在 DE 区”。当前 `LONG01_HIT` 表达式只显式检查 `RAW_VLD` 和 `RAW_IDX != 0`，没有直接写出 DE 条件；是否由上游 `RAW_VLD` 保证 DE 限定，不能单凭这一段 RTL 判定。需要另设 VBP 注错负向场景，验证非 DE 的 `00/7f` 不增加帧计数；若实际增加，应保留波形并报告规范/RTL 分歧。该负向场景不混入四档门限流程，以免污染累计值。
- 本计划只要求数字侧 long01 检测、K4 清零及触发路径；不把图像数值、模拟输出或触发后的恢复图像作为判据。
- 当前已实现 case；SV/UVM 编译和 DUT 仿真结果仍需服务器确认。
