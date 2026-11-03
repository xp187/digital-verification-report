# t_8b1lane_checksum_commit_chip0 Verification Plan

## 状态、运行条件和帧数

- 状态：本 case 的 SV、20 份 cfg 和独立 Python 安装器已生成；Python 与配置静态核对通过，未运行 UVM 编译或 DUT 仿真。其余七个 case 仍按各自文档推进。
- 固定 CHIP_SEL=0；基于 t_8b1lane，通过现有 CHPI sequence 发送全部配置。每帧可同时写多个目标字段，不 force 被测寄存器。
- 本 case 计划 **20 个配置帧槽位**，F0 起计。有效配置帧、开启过渡帧、复位恢复槽位在表中区分；半帧不能算作三帧匹配样本。
- 八个 case 预算：commit 20+20、mode 60+60、unlock 24+24、boundary 56+64，共 **328 帧槽位**。若链路重锁需额外槽位，实施时显式统计并更新 FRAME_NUM、cfg 和 checker 索引；不得裁掉场景凑预算。
- env_cfg.sv 不修改；不生成 PPM。沿用正常单 lane 数据发送或小型运行时数据。此处检查寄存器保护，不重复模拟电气特性、ACS 阈值或 SMART_CS 的完整功能验证。
- 使用正常 CHPI 模式，关闭 I2C test bypass；保持 port/时钟/链路基线稳定。无关的公共图像 checker 关闭，避免把本帧发送配置误当成本帧生效配置。

## Golden 规则与待确认差异

1. 截图规格：0x07[3:0] CTRLF_CHECKSUM 默认 0000，0101 关闭保护；8-bit XOR 连续三帧一致时，在第三帧校验完成提交。
2. 为接替旧回归，暂采用扩展参与集合：**00,01,02,03,04,05,06,08,09,0A,1D,1E,1F,27**；控制字节 07 不参加 XOR。此范围与截图地址描述不同，实施前需当前完整规格确认；不能以 DUT 输出反推范围。
3. 0x27 为候选集合末字节，旧 checker 无独立 shadow。暂按“参加 XOR，在应提交帧使用当帧末字节更新”提出独立期望，需规格确认；无 shadow 不代表直接写，也不能让 actual 充当 expected。
4. 非 0101 编码开启、连续五次失配后下一帧单次 NG unlock，是本轮保留旧回归的兼容要求；截图本身未完整定义这些扩展。若规格冲突，记录差异，不能静默修改 golden 或跳过场景后宣称覆盖完成。

## 配置向量

同一帧同时写多个寄存器。下表数值为十六进制，选中地址的所有位都应显式配置，不能依赖 env_cfg 默认值；表外字段保持合法、稳定的 t_8b1lane 链路基线。CHECKSUM 控制字段由场景表另外给出。

| 地址 | A：基线 | B：第一组 | C：第二组 | D：交错组 |
| --- | --- | --- | --- | --- |
| 0x00 | 00 | 20 | 40 | 60 |
| 0x01 | 20 | 20 | 20 | 20 |
| 0x02 | 00 | 00 | 00 | 00 |
| 0x03 | 00 | 00 | 00 | 00 |
| 0x04 | 00 | 00 | 00 | 00 |
| 0x05 | 20 | 20 | 20 | 20 |
| 0x06 | 02 | 00 | 02 | 00 |
| 0x08 | 00 | 03 | 01 | 02 |
| 0x09 | 00 | 00 | 00 | 00 |
| 0x0A | 00 | 00 | 00 | 00 |
| 0x1D | 00 | 07 | 02 | 05 |
| 0x1E | 10 | 55 | AA | 96 |
| 0x1F | 00 | FF | 00 | AA |
| 0x27 | 00 | 80 | 00 | 80 |

按候选参与集合计算，A/B/C/D 的 8-bit XOR 为 **12 / 0E / EB / DB**，四者非零且互不相同。实施时由生成器独立复算，不能取 DUT 的校验结果。

共同字段：PORSD=1、CH_SEL=001、SCREN=0；AVE_RGBW=0/1/2/3，SDC=1/0/1/0，RBC 两位=00/11/01/10，SP_S=0/7/2/5，VBK=10/55/AA/96，ACS_EN=0/1/0/1；Skip_frame_count、Level_Skip_frame 均为 0。

`0x1F[7:0]` 从高到低为 PWRC_P3/PWRC_N3/PWRC_P2/PWRC_N2/PWRC_P1/PWRC_N1/VBK_EN/PWRC_CTRL；FF/00 保证八个字段都有双向变化，AA 补交错位。0x02[7:2]、0x09、0x0A 按本模式保留位固定零，不写 CHIP_SEL=1 的 SMART_CS/SR/PWRC 字段。

BYTE0_BIT3_0、VPS_EN、sw_reg_lane_ctrl、SD_CHOP/SD_CHOP_F、TP_CONTROL、STP_EN、DPLC/AVE 未使用位和保留位按表清零；boundary 指定单字段修改时除外。

## 共用精简 checker 与采样

八个 case 后续共用一个 checksum_checker.sv，经 include 放入 case；case 只提供输入向量和逐帧期望。用少量数组/task，不写复杂 checker class、不重写 cfg 解析框架、不生成每帧完整 Markdown dump。

- 核心比较全部实际生效字节/字段；有独立 shadow 的地址同时比较当前接收值。保留位按确认的可写/读回规则固定或屏蔽，不能任意期待保留位可写。
- 路径参考：chip_tb_top.u_HK1V11.u_HK1V11_digital_top.u_LOGIC_CENTER.LINK_LOGIC.LINK_CONFIG_CTRL.LC_CPUWR。十进制命名 R_REG29_F/30_F/31_F/39_F 分别对应 0x1D/1E/1F/27。
- 配置结束用不受 checksum enable 限制的接收末地址写事务。0101 模式不能等待仅在保护开启时产生的 frame_end_a。
- 每地址写入后检查 shadow/直接写；末字节写入前检查旧生效值，写入后等待已确认 FF_DLY/NBA 稳定再比较新生效值。提交帧之前不能有部分字段提前更新。
- 0101 或 unlock 直接写入按每个地址自己的写入事件检查，不要求整帧原子更新。0x07 在自身写入时改变模式，切换帧按地址顺序处理。
- expected 来自下表与输入向量；不能由 DUT update_en_a、match_a、unlock、shadow 或 R_REG 决定 expected。内部控制信号只可辅助定位。
- 全程四态比较 !==；日志只含 case、frame、address/field、actual、expected。一处总超时，加实际帧数和场景计数即可；缺帧不能 warning 后当 PASS。

```systemverilog
if (actual !== expected)
    `uvm_error("CHECKSUM", $sformatf(
        "frame=%0d addr=%02h actual=%02h expected=%02h",
        frame_id, address, actual, expected))
```

## 逐帧激励与生效期望

| 帧 | 输入 | CHECKSUM | 帧末生效值 | 检查目的 |
| --- | --- | --- | --- | --- |
| F0 | A | 5 | A | 关闭保护，建立基线 |
| F1 | A | 0 | A | 开启过渡帧，不计作完整保护帧 |
| F2 | A | 0 | A | 首个完整保护参考帧；输入等于基线，不以它证明提交延迟 |
| F3 | B | 0 | A | B 第一次 |
| F4 | B | 0 | A | B 第二次 |
| F5 | B | 0 | B | B 第三次，整组提交 |
| F6 | C | 0 | B | C 第一次 |
| F7 | C | 0 | B | C 第二次 |
| F8 | C | 0 | C | C 第三次，再次提交 |
| F9 | B | 0 | C | B 第一次 |
| F10 | B | 0 | C | B 第二次 |
| F11 | C | 0 | C | 打断 B 的连续匹配 |
| F12 | B | 0 | C | 重新累计 B 第一次 |
| F13 | B | 0 | C | 重新累计 B 第二次 |
| F14 | B | 0 | B | 重新累计 B 第三次 |
| F15 | D | 0 | B | 交错配置第一次 |
| F16 | D | 0 | B | 交错配置第二次 |
| F17 | D | 0 | D | 交错配置第三次 |
| F18 | D | 0 | D | 稳定保持 |
| F19 | D | 0 | D | 稳定保持并结束 |

shadow 在每个地址收到后跟随当前输入；生效值按上表延后。F3-F19 都是完整保护帧。F5/F8/F14/F17 末字节之前仍保持旧组，末字节写入稳定后全部目标字段更新为新组。

## 必须检出的错误

- 两帧或更早更新、第三帧不更新、晚到下一帧才更新、只更新部分字段。
- F11 打断后仍沿用 B 的旧进度，导致 F12/F13 提前提交。
- B/C 多字段 XOR 抵消。生成时核对本计划给出的非零不同校验值。
- 初始化过渡帧被计作有效帧、cfg_frame0 与接收帧错位。
- 保持阶段允许内部重复提交同一个值，不把“必须产生额外状态脉冲”当通过条件。

## 旧 case 覆盖对应

- 原 checksum_pwrc、pwrc_n1/n2/n3/p1/p2/p3 及各自 longtest：B/C 整组翻转、D 交错、反复提交和保持。
- 原 checksum_vbk_en 和 longtest：VBK_EN 与其他字段同步变化并逐字段比较；CHECKSUM 编码变化移到 mode_chip0。
- 原 checksum_addr39_ACS_EN 和 longtest：0x27 的 ACS_EN 独立末字节比较，不做 actual 自比较。
- 原 checksum_sdc 仅有 SVM 备份且缺 cfg，将其 SDC 0/1 提交意图补齐。

多寄存器组会逐字段比较，不能只检查 XOR 相等。单地址校验参与性由同模式 boundary case 承担；所有 case 合起来完成替代，不声称任意单个 case 就覆盖全部旧回归。

## 通过条件和实施检查

- 所有表中保持/提交帧及全部目标字节逐项比较。
- 旧目标单 bit 字段有双向变化，SR/PWRC 二位字段有 00/01/10/11，RBC 两位都有双向变化。
- 核对该模式全部目标字段在输入中确有变化、期望中有对应、实际比较没有遗漏；不出现 R_R_ 等重复前缀。
- 全部计划槽位与有效配置帧被计数，缺尾帧或场景未运行必须失败。
- 提交时间、实际寄存器值、0x27 特殊路径均按独立期望检查，不能因 DUT 没发 update_en 而跳过应提交帧。
- 本 case 已按当前 RTL 接口实现；0x27 无 shadow、在提交时写当帧末字节的路径已核对。扩展地址集合的完整规格依据仍保留为确认项；UVM 编译、首帧接收对齐、DUT 仿真及最终旧覆盖替代核对待执行。

## 参考文件

- [env_cfg.sv](../../agents/isprx_env/env_cfg.sv)：当前两模式字节打包映射。
- [checker_for_checksum.sv](../../agents/isprx_env/isptx_agent/checker_for_checksum.sv)：旧地址、层次及兼容行为参考；不沿用 DUT update_en 驱动 loaded 期望的方式。
- [t_8b1lane](../t_8b1lane/)：发送流程与环境基线。
- 本对话提供的寄存器截图及用户确认的一帧多寄存器合并要求。

## 实现与安装

- 独立脚本：`E:\projects\HK1V11_top_1012\generate_t_8b1lane_checksum_commit_chip0.py`，仅依赖 Python 标准库，支持 Python 3.9 语法。
- 运行脚本生成当前目录下的 test、局部发送 sequence、include checker、20 份 cfg、宏/编译/波形文件及 README，并登记 regression/testname.f。安装时保留本计划。
- 传输使用 `FRAME_NUM=19`：训练后先发送 cfg_frame0，19 个图像帧各在最后活动行发送下一份配置，恰好覆盖 F0-F19。无 cfg_frame20 或额外未检查配置。
- 局部 isptx_sequence 子类覆盖 virtual send_ppm，沿用现有训练与 CTRL_F/CTRL_L 编码，直接发送 Gray64 活动数据；不读取/写入 PPM，不调用 C model，不修改公共环境。
- checker 145 行，采用固定 CS_INPUT/CS_ACTIVE 帧表，比较 14 个实际寄存器、13 个独立 shadow 和接收 payload；不以 DUT update_en/match/unlock 更新期望。
- 已完成：Python py_compile、3.9 grammar、输入字段与 raw-byte 向量/XOR、帧表独立推算、层次名及生成一致性核对；临时工程中单文件安装、重复安装、回归唯一登记和 env/TB/计划保留检查通过。
- 未执行：完整 UVM/DUT 编译、运行和功能覆盖收集。Python 静态/安装检查不代表 DUT 验证通过。

```bash
python3 generate_t_8b1lane_checksum_commit_chip0.py --dv-top /path/to/DV_TCON_C/top
```
