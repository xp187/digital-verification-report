# UTC_header_cnt[1:0] 验证计划

## 1. 目标与范围

验证寄存器 `0x38[3:2] UTC_header_cnt[1:0]` 对长编码（420b/413b）模式下 header 连续错误行级门限的控制作用。通过正常寄存器配置与 CHPI 长编码输入，在每行构造指定数量的 header 错误，确认错误计数在正确门限触发，并在新行开始后清零。

本计划只验证 `UTC_header_cnt[1:0]`。`UTC_header_frame` 和 `UTC_long01_frame` 固定为较宽松门限，避免它们的帧级错误干扰行级结果；其他协议、模拟输出和图像数值不作为判据。

## 2. 行为依据

寄存器表将该字段描述为“413b420b UTC header continuous error（仅在 DE 区）”。根据当前 RTL，门限由字段值映射如下：

| `UTC_header_cnt[1:0]` | 行内错误门限 T |
|---|---:|
| `2'b00` | 2 次 |
| `2'b01` | 4 次 |
| `2'b10` | 6 次 |
| `2'b11` | 8 次 |

RTL 的 header 错误事件条件是：当前 420b block header 的 bit 0 与前一个 block 末尾 bit 相同。每个满足条件的 block 边界计一次。达到 T 后，`HEADER_ERROR_LINE` 拉高。上层 `UTC_ERR` 同时包含 header tag mismatch 错误，所以激励必须保持 tag 合法且连续一致，以隔离本字段的效果。

门限表按用户指定以 RTL 为准。寄存器表未列出四种编码对应的数值。

## 3. Case 结构

- Case 名：`t_8b1lane_UTC_HEADER_CNT`
- 单一 test，使用标准长编码发送与配置提交流程。
- `frame_num = 4`，每帧对应一种 `UTC_header_cnt` 编码，按 `00 → 01 → 10 → 11` 顺序运行。
- 每个配置帧保持项目现有的 VBP、VFP 和行周期设置，不压缩帧间隔。
- 每帧使用相同的 16 条 active line 图像输入；前三条 active line 分别用于 T-1 边界、T 触发边界、K1 后清零检查，其余行发送无错误数据。
- 通过正常 CTRL_F/寄存器序列提交配置；确认配置生效后才对该帧的数据结果做判定。
- 长编码输入使用 `SCREN=0`，并确保 RTL 侧 `TEST_UTC_ENA=1`；保持稳定、非保留的 6-bit header tag，payload 避免产生 `7'h00`/`7'h7f`，header tag 在块间一致。

## 4. 错误注入方式

使用 case 专用的发送 sequence/helper，在现有 `isptx_sequence` 的长编码路径上生成标准有效 active-line 数据。完成 413b→420b 编码后，仅修改指定 420b block 的 header toggle bit：把该 bit 设置成前一个 block 的末尾 bit，构造一个 header 错误事件。错误块之间保持其余 header/tag/payload、编码长度、K1/K2 和行时序有效。

每条目标行在 K1 后先发送一个正常 block 作为前一块末尾 bit 的建立数据；随后按该行目标数，选择后续 block 的 header toggle bit 注入错误。其余 block 使用正常交替 toggle。这样每条目标行的错误数可精确控制为 `T-1`、`T` 或 `0`。

注入后仍通过现有 20-bit packet driver 发送编码流；每个 420b block 长度及 20-bit packet 对齐保持不变。不得通过 force RTL 错误计数或错误标志来制造结果。

## 5. 四种编码的逐帧激励与期望

每帧前三条 active line 如下。每条新行由 K1 开始，并检查行计数器是否按行边界重新开始。

| 帧 | 配置值 | 门限 T | Active line 0：T-1 个错误 | Active line 1：T 个错误 | Active line 2：0 个错误 |
|---:|---|---:|---|---|---|
| 0 | `00` | 2 | 1 次后不报错 | 第 2 次错误触发 | K1 清零期望需检查（见 RTL 风险） |
| 1 | `01` | 4 | 3 次后不报错 | 第 4 次错误触发 | K1 清零期望需检查（见 RTL 风险） |
| 2 | `10` | 6 | 5 次后不报错 | 第 6 次错误触发 | K1 清零期望需检查（见 RTL 风险） |
| 3 | `11` | 8 | 7 次后不报错 | 第 8 次错误触发 | K1 清零期望需检查（见 RTL 风险） |

每个 T 行在第 T-1 个错误之后仍须保持 `HEADER_ERROR_LINE=0`、`UTC_ERR=0`；第 T 个错误被接收后须拉高。下一行 K1 后检查行计数及错误标志是否清零，这是行级门限的边界检查。当前 RTL 在 `HEADER_ERROR_LINE=1` 时优先保持计数，K1/K4 清零分支不会执行；若波形确认仍保持，则记录为 RTL 与逐行清零预期的差异，不能把“继续保持”当作 checker 的期望通过结果。其余 active line 不注入错误。

每帧累计 header 错误最多为 `(T-1)+T`，最大 15。固定 `UTC_header_frame=3'b111`（RTL 门限 24），固定 `UTC_long01_frame=2'b11`（RTL 门限 32），并保持 payload 不含 `00/7f`，使 `UTC_FRM_ERR` 在本测试中保持 0。

## 6. DE 区域限定检查

寄存器表注明该错误只在 DE 区检测。首版 case 暂不执行 VBP 负向注入：现有长编码发送流程没有独立 reset/retrain 子运行入口，而触发后的行计数在当前 RTL 中可能保持；把 VBP 样本并入四档 sweep 会污染后续门限结果。该点作为后续扩展项保留，不计入本版 PASS 条件。

当前错误控制模块没有显式 DE 输入端口，检查路径使用解码器送来的有效 raw data。后续隔离运行需确认 VBP 注入是否被上游有效数据路径排除；若 VBP 错误被计入并触发，记录为“仅在 DE 区”规格与当前 RTL 数据限定行为不一致，不能通过放宽 checker 处理。

## 7. Checker 检查点

Checker 保持精简，仅按当前帧/行的计划错误数比较配置及结果：

1. 配置检查：当前 `UTC_header_cnt[1:0]` 等于该帧计划值，且 `TEST_UTC_ENA=1`。
2. 行计数检查：在每条目标行发送完成后比较 `HEADER_ERROR_LINE_CNT`；T-1 行期望为 T-1，T 行期望达到 T，下一条无错误行期望在 K1 后清零。
3. 主功能检查：T-1 阶段 `HEADER_ERROR_LINE=0` 且 `UTC_ERR=0`；第 T 个错误之后两者置 1；下一 K1 后检查是否按行边界恢复为 0。
4. 隔离检查：`HEADER_MISMATCH_ERROR=0`，`UTC_FRM_ERR=0`；发现任何意外 tag mismatch、帧级错误、X/Z 或有效样本缺失均报错。
5. 结果不依赖单纯等待或固定延时判 PASS；每个配置值必须实际观察到 T-1、T 和 K1 边界检查三个阶段。K1 清零与否按规格期望检查；当前 RTL 可能不满足，作为明确失败/待设计确认项。

Case checker 直接采样 long decoder 的层次状态和 `LC_CHPI_DECODE.UTC_ERR/UTC_FRM_ERR`，检查 `UTC_HEADER_CNT`、`HEADER_ERROR_LINE_CNT`、`HEADER_ERROR_LINE`、`UTC_ERR`、`HEADER_MISMATCH_ERROR` 和 `UTC_FRM_ERR`。MONI `0x12` 的低 4 bit 及 MONI `0x0E` 的 bit 1/bit 0 保留为波形交叉核对点。

## 8. 预计波形信号

- 配置：`UTC_header_cnt[1:0]`、`UTC_header_frame[2:0]`、`UTC_long01_frame[1:0]`
- 输入/边界：长编码 `K1_FIND`、`K4_FIND`、DE 区间、解码有效数据
- 计数和判定：`HEADER_ERROR_LINE_CNT`、`HEADER_ERROR_LINE`、`HEADER_MISMATCH_ERROR`、`HEADER_ERROR_FRAME_CNT`、`HEADER_ERROR_FRAME`、`LONG01_ERROR_FRAME_CNT`、`LONG01_ERROR_FRAME`
- 对外结果：`UTC_ERR`、`UTC_FRM_ERR`

## 9. 预计 case 文件

本目录实现文件：

- `t_8b1lane_UTC_HEADER_CNT.sv`：case 主体及标准配置/发送 sequence 启动
- `utc_header_cnt_checker.sv`：上述配置、门限、清零和 DE 限定检查
- `t_8b1lane_UTC_HEADER_CNT.sv`：case、派生 TX sequence、active-line header 注入和常量像素流
- `utc_header_cnt_checker.sv`：门限/状态检查
- `cfg_frame0.txt` 至 `cfg_frame4.txt`：四档寄存器值及最后一帧后的保持配置
- `user_def.sv`、`waves_dumper.sv`、`test.f`、`test_lib.sv`、`README.md`
- case 不需要 PPM 文件；派生 sequence 直接构造固定像素队列，不调用 C-model golden 图像流程
- `regression/testname.f`：加入单条 case 登记

后续按项目约定把 case 加入 `regression/testname.f`。本次仅创建验证计划，不创建上述代码或图像文件，不修改 `env_cfg.sv`、共享 sequence、RTL 或回归清单。

## 10. 通过标准

- 四种配置值均实际写入且被 DUT 接收。
- 对每种值，T-1 个 header 错误不触发，恰好第 T 个触发。
- K1 后按逐行门限预期检查计数及 `UTC_ERR` 清除；若 RTL 保持，报告为已定位的边界差异。未达到门限的行在 K1 后必须清零。
- 被测帧内 `UTC_FRM_ERR` 保持为 0，header tag mismatch 保持为 0。
- VBP 的 DE-only 负向样本不在本版执行，不作为 PASS 条件。
- 每个阶段均有有效输入及有效观察样本；缺样或未触发不计为 PASS。

## 11. RTL 风险与验证限制

- 当前 `LONG_ENCODING_ERROR_CTRL.v` 中 `HEADER_ERROR_LINE_CNT` 的时序分支先判断 `HEADER_ERROR_LINE`，再判断 K1/K4/UTC disable。计数达到门限后，flag 拉高会挡住后续清零分支；即使新行开始，计数也可能保持在门限值，`UTC_ERR` 随之保持。计划会检查此边界并将与逐行清零预期的差异明确报告，不通过修改 checker 期望来掩盖。`HEADER_ERROR_FRAME_CNT` 有相同的优先级结构，应避免把它当作本字段行级判据。
- 当前非 FPGA 仿真中，模拟宏模型的 `UTC_ENB_I` 输出无驱动；Case 将 `chip_tb_top.u_HK1V11.UTC_ENB_I` 固定为 0，启用 long UTC detector。为在同一仿真中继续观察四档阈值，仅将 `LINK_FAULT_CTRL.UTC_RST_REQ` 固定为 0，抑制错误后的复位请求；不 force 检测计数器或状态标志。
- VBP 负向激励需独立 reset/retrain 后运行，当前版本未实现该隔离子运行。
- 本文件是实现前计划，尚未运行 SV/UVM 编译、仿真或波形检查。四档门限按用户指定以当前 RTL 映射为准；DE 区限定仍需实际负向样本确认。
