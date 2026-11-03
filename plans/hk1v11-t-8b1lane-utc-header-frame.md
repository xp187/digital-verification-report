# UTC_header_frame[2:0] 验证计划

## 1. 目标与依据

- 被测字段：CTRL_F `0x39[2:0] UTC_header_frame[2:0]`，复位/锁定输出默认 `3'b011`。
- 寄存器表描述为长编码 413b/420b 在 DE 区的 header 帧累计错误门限。本计划检查 **420b block 边界的 header toggle 错误事件数**，不把“错误行数”当作计数单位。
- `LONG_ENCODING_ERROR_CTRL.v` 中，当前 block header bit 0 与前一 block 最后一位相同且 header 有效时，产生 `HEADER_ERROR_EVENT`。`HEADER_ERROR_FRAME_CNT` 对该事件逐次加一；`K1_FIND` 不清零帧计数，未达到门限时 `K4_FIND` 或关闭 UTC 检测使其清零。达到门限后，`HEADER_ERROR_FRAME` 的保持分支优先于 K4 清零。
- 长编码路径中 `UTC_FRM_ERR = HEADER_ERROR_FRAME | LONG01_ERROR_FRAME`。`UTC_FRM_ERR` 也直接送入接收 PHY 的失锁路径。因此触发后不能假定下一帧还能正常接收配置。
- RTL 来源目录：`E:\projects\HK1V11_top_1012\cmodel\test\HV2A31\HDL\HK1V11_digital_top`。依据文件为其中的 `long_encoding/LONG_ENCODING_ERROR_CTRL.v`、`seperated_code/LC_CHPI_DECODE.v`、`rx_phy/rx_phy_unit_flag_gen.v`，以及已有 `t_8b1lane_UTC_HEADER_CNT` 的私有 420b 注错 sequence。

| `UTC_header_frame` | 触发门限 T | T−1 分配到连续 active line | 第 T 次所在行 |
|---|---:|---|---:|
| `000` | 3 | `2` | 下一行 `1` |
| `001` | 4 | `3` | 下一行 `1` |
| `010` | 6 | `5` | 下一行 `1` |
| `011` | 8 | `7` | 下一行 `1` |
| `100` | 10 | `7+2` | 下一行 `1` |
| `101` | 12 | `7+4` | 下一行 `1` |
| `110` | 16 | `7+7+1` | 下一行 `1` |
| `111` | 24 | `7+7+7+2` | 下一行 `1` |

表中的每个数字是一条 active line 内注入的事件数。每行最多 7 次；`UTC_header_cnt=11` 的行门限是 8，因此本 case 的正确激励不应触发 `HEADER_ERROR_LINE`/`UTC_ERR`。

## 2. Case 组织与发送

- 实现一个 test：`t_8b1lane_UTC_HEADER_FRAME`，一次仿真内由 virtual sequence 顺序遍历 `UTC_header_frame=000` 至 `111`。每档使用新的 TX sequence；第 T 次触发 `UTC_FRM_ERR` 后等待接收端失锁，再按正常训练流程发送下一档。
- 每档发送设 `FRAME_NUM=2`，保持已有 `UTC_HEADER_CNT` case 的 `CHPI_MODE_420B`、3840×16、VBP/VFP、HBP/HFP 及完整行周期。使用 case 私有 `isptx_sequence`，不修改 `env_cfg.sv` 或 RTL，不生成 PPM；常量像素队列由 sequence 创建。
- `env_cfg.get_ctrlF_reg()` 会重新读取静态 `cfg_frame*.txt`；仅设置 plusarg 或 `env_cfg.UTC_header_frame` 不能改变真正发出的配置。virtual sequence 在每档启动前从 `FILE_PATH` 写入 `cfg_frame0.txt`、`cfg_frame1.txt` 和末尾保持配置；三个文件都写入该档目标字段，沿正常 CTRL_F 路径发送。不需要额外 plusarg 或手动准备。`SCREN=0`、`PORSD=1`、`CH_SEL=001`、`TEST_PRTCT=0x72`；发送目标数据前比较 DUT 生效字段与本次选择值。
- 固定 `UTC_header_cnt=11`（行门限 8）和 `UTC_long01_frame=11`（long01 帧门限 32）。保持 header tag 合法且一致，payload 不生成 `7'h00`/`7'h7f`。沿用上一 case 的方法：先正常编码，再只将目标 420b block 的 header toggle bit 改为前一 block 的末位；每行首个 block 不注错，保持 K1/K2、20-bit packet 对齐和编码长度有效。
- 非 FPGA 模拟宏 `UTC_ENB_I` 无驱动时，沿用上一 case 的 `UTC_ENB_I=0` 使能条件，并检查 RTL `TEST_UTC_ENA/N_UTC_ENB` 确实有效。不 force 计数器、错误标志、锁状态或接收 PHY 的失锁输出。

## 3. 每档两帧流程

**Frame 0：T−1 与 K4 清零。** 在前几条 active line 按表中分配注入，总计 T−1 次。每行结束比较累计计数，证明 K1 没有把帧计数清掉；最后一条目标行必须得到 `HEADER_ERROR_FRAME_CNT=T−1`、`HEADER_ERROR_FRAME=0`、`UTC_FRM_ERR=0`。余下 active line 不注错，计数保持 T−1。在 VFP 的正常 CTRL_F/K4 边界，等计数器更新一个 DCLK 后检查计数为 0、帧错误标志仍为 0；同值配置继续供下一帧使用。

**Frame 1：T−1/T 边界。** 再次按表中前缀分配注入，逐行检查累计值，T−1 时帧错误仍为 0。下一条 active line 只注入 1 次，接收第 T 个事件后检查 `HEADER_ERROR_FRAME_CNT=T`、`HEADER_ERROR_FRAME=1`、`UTC_FRM_ERR=1`。在同一采样点要求 `HEADER_ERROR_LINE=0`、`UTC_ERR=0`、`HEADER_MISMATCH_ERROR=0`、`LONG01_ERROR_FRAME=0`，把帧级 header 错误与其他 UTC 来源隔离。

第 T 次错误可能使链路随即失锁；checker 必须在计数/标志更新时捕获触发结果，随后结束当前档的判定，不把后续帧或重新 lock 当作此 case 的隐含 PASS 条件。若错误触发快于 checker 可观察的有效窗口，则该档报告未完成，不能因超时或仿真自然结束而算 PASS。门限后的 K4 清零不作为期望：当前 RTL 已触发时会保持计数。

## 4. Checker 与覆盖记录

checker 使用当前配置值查表得到 T，并维护本次运行的预期累计事件数。只在已经发送完、并且 DUT 已接收的目标 block/行后采样；对关键边界做精确四态比较：

1. 配置与使能：有效 `UTC_HEADER_FRAME` 等于本次参数，长编码模式与 UTC 检测使能成立。
2. 计数：Frame 0 每行的累计前缀、T−1、K4 后 0；Frame 1 每行的累计前缀、T−1、T。出现漏计、重复计数或跨 K1 清零均报错。
3. 状态：T−1 及以前 `HEADER_ERROR_FRAME=0`、`UTC_FRM_ERR=0`；恰好第 T 次后两者为 1。
4. 隔离：所有有效检查点 `HEADER_ERROR_LINE=0`、`UTC_ERR=0`、`HEADER_MISMATCH_ERROR=0`、`LONG01_ERROR_FRAME=0`。这些信号若产生 X/Z 也判失败。
5. 覆盖：8 档各自记录配置提交、Frame 0 T−1、K4 清零、Frame 1 T−1 与 T 触发。一次仿真内 8 档均完成触发检查及档间重新训练，才称门限编码全覆盖。波形至少保留 `HEADER_ERROR_EVENT`、`K1_FIND`、`K4_FIND`、两个 header 计数、两个 header 标志、`UTC_ERR`、`UTC_FRM_ERR`、`N_RST_NLOCK` 和配置值。

checker 仅按本 case 的目标事件、计数和标志比较，不引入图像 golden model。具体采样边沿和 UVM 对象层次在编码时按实际 testbench 确认；不能用发送端“计划注入数量”代替 DUT 侧事件与结果观察。

## 5. 完成标准与范围边界

- 一次仿真中的每档都必须通过 Frame 0 的 T−1 不触发与 K4 清零，以及 Frame 1 的 T−1 不触发和第 T 次触发；任一档无有效样本即不算覆盖完成。
- `UTC_FRM_ERR` 后若接收 PHY 按设计失锁，属于可观察的后续动作，不要求下一帧继续配置或图像输出；本计划不通过 force 锁信号来回避它。
- 寄存器表的“仅在 DE 区”限定仍需单独的 VBP 负向注错运行确认。现有私有 active-line 注错接口只覆盖 DE，本计划不把 DE-only 宣称为已验证；实施该负向场景时应在独立的复位场景中完成，避免污染门限测试。
- 本目录已实现一次仿真遍历 8 档的 case、checker 和运行时配置写入；尚未运行服务器上的 SV/UVM 编译或 DUT 仿真。
