# t_8b1lane_checksum_unlock_chip1 Verification Plan

## 状态、运行条件和帧数

- 状态：已生成SV、24份cfg及独立Python安装器；Python语法、配置/帧表和独立安装核对通过，完整UVM编译及DUT仿真待执行。
- 固定 CHIP_SEL=1；基于 t_8b1lane，通过现有 CHPI sequence 发送全部配置。每帧可同时写多个目标字段，不 force 被测寄存器。
- 本 case 计划 **24 个配置帧槽位**，F0 起计。有效配置帧、开启过渡帧、复位恢复槽位在表中区分；半帧不能算作三帧匹配样本。
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
| 0x02 | 00 | 4C | CC | 80 |
| 0x03 | 00 | 00 | 00 | 00 |
| 0x04 | 00 | 00 | 00 | 00 |
| 0x05 | 20 | 20 | 20 | 20 |
| 0x06 | 02 | 00 | 02 | 00 |
| 0x08 | 00 | 03 | 01 | 02 |
| 0x09 | 00 | FF | 55 | AA |
| 0x0A | 00 | FF | 55 | AA |
| 0x1D | 00 | 07 | 02 | 05 |
| 0x1E | 10 | 55 | AA | 96 |
| 0x1F | 00 | FF | 55 | AA |
| 0x27 | 00 | 80 | 00 | 80 |

按候选参与集合计算，A/B/C/D 的 8-bit XOR 为 **12 / 42 / 72 / 5B**，四者非零且互不相同。实施时由生成器独立复算，不能取 DUT 的校验结果。

共同字段：PORSD=1、CH_SEL=001、SCREN=0；AVE_RGBW=0/1/2/3，SDC=1/0/1/0，RBC 两位=00/11/01/10，SP_S=0/7/2/5，VBK=10/55/AA/96，ACS_EN=0/1/0/1；Skip_frame_count、Level_Skip_frame 均为 0。

SMART_CS 的字段值 A/B/C/D=0/7/F/8，拆到 0x02[7:6] 和 [3:2]，字节为 00/4C/CC/80。0x09 从高到低为 SR_NF/SR_NR/SR_PF/SR_PR；0x0A 为 PWRC_N/PWRC_P/PWRC_TB/PWRC_TA；0x1F 为 PWRC_NB/PWRC_NA/PWRC_PB/PWRC_PA。00/FF/55/AA 覆盖二位字段编码，不使用 CHIP_SEL=0 的单 bit 字段名。

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

## 行为依据

此 case 保留旧回归的 NG unlock 机制：连续五次失配，仅下一完整配置帧直接写，随后恢复三帧保护。该机制需当前完整规格确认。不能见到 DUT unlock 标志提前置位就提前改变 expected。

B/C 与 A 校验值不同且彼此不同，连续交替会每帧失配；旁路帧用 D 或 A，保证值与当时生效配置不同，确实可观察。

## 逐帧安排

除F0=5外，CHECKSUM均为0。实施时增加F3的完整相同A帧：F1是半帧开启过渡，其校验历史不能带入五次人为连续失配的计数。F2/F3两个完整A至少提供一次匹配，清除启动阶段的失配历史，再从F4开始门限检查。原计划F3~F20整体后移一帧，复用一个尾部稳定帧，总数保持24，不修改门限规则。

| 帧 | 输入 | CHECKSUM | 帧末生效值 | 检查目的 |
| --- | --- | --- | --- | --- |
| F0 | A | 5 | A | 关闭保护，建立基线 |
| F1 | A | 0 | A | 开启过渡，不作为完整保护帧 |
| F2 | A | 0 | A | 首个完整保护参考帧 |
| F3 | A | 0 | A | 第二个完整A，匹配一次清除启动失配历史 |
| F4 | B | 0 | A | 第一轮第1次失配 |
| F5 | C | 0 | A | 第一轮第2次失配 |
| F6 | B | 0 | A | 第一轮第3次失配 |
| F7 | C | 0 | A | 第一轮第4次失配，不旁路 |
| F8 | B | 0 | A | 第一轮第5次失配，本帧仍保持 |
| F9 | D | 0 | D | 第一轮单帧旁路，各地址在自己的写入beat变D |
| F10 | C | 0 | D | 立即恢复保护，C第一次 |
| F11 | C | 0 | D | C第二次，仍保持D |
| F12 | C | 0 | C | C第三次，帧末提交 |
| F13 | B | 0 | C | 第二轮第1次失配 |
| F14 | C | 0 | C | 第二轮第2次失配 |
| F15 | B | 0 | C | 第二轮第3次失配 |
| F16 | C | 0 | C | 第二轮第4次失配，不旁路 |
| F17 | B | 0 | C | 第二轮第5次失配，本帧仍保持 |
| F18 | A | 0 | A | 第二轮单帧旁路，各地址在自己的写入beat变A |
| F19 | D | 0 | A | 立即恢复保护，D第一次 |
| F20 | D | 0 | A | D第二次，仍保持A |
| F21 | D | 0 | D | D第三次，帧末提交 |
| F22 | D | 0 | D | 稳定检查 |
| F23 | D | 0 | D | 稳定且完成最后配置 |

## 门限、持续时间和恢复检查

- F7/F16：第四次失配，全部被保护地址保持旧值，不得提前旁路。
- F8/F17：第五次失配，本帧仍保持旧值；不得把下一帧的放行回溯到本帧。
- F9/F18：恰好一帧逐地址直接写入；每个接受沿前检查保持到该沿前的期望，沿后检查对应字节新值，其余字节继续保持。
- F10/F19：立即恢复保护，不得多旁路一帧；F11/F20继续保持，F12/F21第三帧才提交。
- 两轮门限相同；14个实际生效字节、13个shadow、payload和0x07均比较；0x27没有shadow，以自己的独立预期检查末字节。
- checker仅以固定CS_INPUT/CS_MODE/CS_BYPASS/CS_COMMIT和接收beat形成期望，不以DUT unlock/update/match决定是否检查、何时提交或旁路。

## 旧 case 覆盖对应

- checksum_addr09_SR_PR_ng_unlock：SR_PR 在 B/C 中取 11/01，相邻帧校验不同；同时比较其余三个 SR 字段。
- 增加 SMART_CS 和本模式 PWRC 在同一次旁路中的逐地址更新比较。

多寄存器组会逐字段比较，不能只检查 XOR 相等。单地址校验参与性由同模式 boundary case 承担；所有 case 合起来完成替代，不声称任意单个 case 就覆盖全部旧回归。

## 通过条件和实施检查

- 两轮均有四次不放行、第五次为下一帧准备、恰好一次完整帧旁路、恢复后的三帧提交证据。
- 核对该模式全部目标字段在输入中确有变化、期望中有对应、实际比较没有遗漏；不出现 R_R_ 等重复前缀。
- 全部计划槽位与有效配置帧被计数，缺尾帧或场景未运行必须失败。
- 提交时间、实际寄存器值、0x27 特殊路径均按独立期望检查，不能因 DUT 没发 update_en 而跳过应提交帧。
- 本case已实现；扩展地址集合、0x27路径和NG unlock规则沿用已批准计划，完整规格确认、首帧对齐、UVM编译/DUT仿真及旧覆盖替代核对仍待完成。

## 参考文件

- [env_cfg.sv](../../agents/isprx_env/env_cfg.sv)：当前两模式字节打包映射。
- [checker_for_checksum.sv](../../agents/isprx_env/isptx_agent/checker_for_checksum.sv)：旧地址、层次及兼容行为参考；不沿用 DUT update_en 驱动 loaded 期望的方式。
- [t_8b1lane](../t_8b1lane/)：发送流程与环境基线。
- 本对话提供的寄存器截图及用户确认的一帧多寄存器合并要求。

## 实施文件与运行

- 独立安装器：`../../generate_t_8b1lane_checksum_unlock_chip1.py`，内嵌全部32份文件，无需其他Python安装器。
- 文件包括test、局部`checksum_unlock_sequence.sv`、include的`checksum_checker.sv`、cfg_frame0~23及编译/波形/README入口；`FRAME_NUM=23`，初始cfg0加23个图像帧末配置，共24次CTRL_F，不生成cfg24或PPM。
- 完整性检查：24帧、两个计划旁路窗口和两个恢复第三帧检查点全部执行且比较无错；计划计数不是DUT控制脉冲数。一个总超时覆盖sequence/checker完成。
- 运行：`python3 generate_t_8b1lane_checksum_unlock_chip1.py --dv-top /path/to/DV_TCON_C/top`，随后`./run_tc.sh TOP t_8b1lane_checksum_unlock_chip1 chip_tb_top 1 clean`。
- 不改env_cfg、RTL、公共agent或其他case；回归只新增本case，安装时保留原验证计划。


- 芯片模式由user_def的CHIP_SEL=1、test.f的+define+CHIP_SEL_1和checker断言一致设置；不使用chip0单bit字段。C组0x1F由原计划00修正为55，与commit/mode_chip1保持一致，12个SR/PWRC二位字段均覆盖四编码，XOR同步为12/42/72/5B。

## 本地核对结果

- Python语法编译及Python3.9 AST通过；32份生成内容与模板逐字一致、ASCII、无残留标记；24份cfg按当前env_cfg字段布局独立打包正确。
- SMART_CS覆盖0/7/F/8，12个SR/PWRC二位字段覆盖00/01/10/11；XOR为12/42/72/5B，未混入chip0单bit配置字段。
- 独立完整帧失配/匹配推演得到两次旁路F9/F18、恢复改变生效组的提交F12/F21，与计划、checker表一致；逐beat检查两次旁路的SMART_CS/RBC/SR/PWRC/SP_S/VBK写前保持与各自接受沿后更新，门限帧和恢复前两帧保持均通过。此处为静态核对和Python推演，未执行SV checker。
- 157行checker与chip0结构一致，独立期望不依赖DUT mode/update/match/unlock；层次/信号、CHIP_SEL宏和回归唯一性核对通过。
- 单个py复制到临时DV树tests目录可自动安装；显式--dv-top和重复安装零改写、原计划/环境/回归保留及无PPM通过。
- 完整规格假设、UVM编译/DUT仿真、首帧对齐和波形验收仍待执行。
