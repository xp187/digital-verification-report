# t_8b1lane_checksum_mode_chip0 Verification Plan

## 状态、运行条件和帧数

- 状态：已生成 SV、60 份 cfg 和独立 Python 安装器；Python语法、配置打包、帧表及独立安装静态核对通过，UVM 编译及 DUT 仿真尚未执行。
- 固定 CHIP_SEL=0；基于 t_8b1lane，通过现有 CHPI sequence 发送全部配置。每帧可同时写多个目标字段，不 force 被测寄存器。
- 本 case 计划 **60 个配置帧槽位**，F0 起计。有效配置帧、开启过渡帧、复位恢复槽位在表中区分；半帧不能算作三帧匹配样本。
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

## F0-F47：全部开启编码各自验证三帧保护

CHECKSUM 编码按十六进制低四位列出，例如 0A 对应 cfg 的 1010。

| 帧 | CHECKSUM | 输入 | 逐帧生效值 |
| --- | --- | --- | --- |
| F0 | 05 | A | A，直接建立基线 |
| F1 | 00 | A | A，开启过渡 |
| F2 | 00 | A | A，完整参考 |
| F3-F5 | 00 | B,B,B | A,A,B |
| F6-F8 | 01 | C,C,C | B,B,C |
| F9-F11 | 02 | B,B,B | C,C,B |
| F12-F14 | 03 | C,C,C | B,B,C |
| F15-F17 | 04 | B,B,B | C,C,B |
| F18-F20 | 06 | C,C,C | B,B,C |
| F21-F23 | 07 | B,B,B | C,C,B |
| F24-F26 | 08 | C,C,C | B,B,C |
| F27-F29 | 09 | B,B,B | C,C,B |
| F30-F32 | 0A | C,C,C | B,B,C |
| F33-F35 | 0B | B,B,B | C,C,B |
| F36-F38 | 0C | C,C,C | B,B,C |
| F39-F41 | 0D | B,B,B | C,C,B |
| F42-F44 | 0E | C,C,C | B,B,C |
| F45-F47 | 0F | B,B,B | C,C,B |

15 个非 5 编码各三帧，共 45 帧。相邻组 B/C 校验值不同，每个编码都有前两帧保持和第三帧提交，不能在不变配置下仅观察 mode 状态来判通过。

## F48-F59：关闭、重开、开启编码切换

| 帧 | CHECKSUM | 输入 | 独立生效期望 |
| --- | --- | --- | --- |
| F48 | 05 | D | 00-06 和 08 均保持 B；06/07/08 同 beat 采样旧模式，09 及后续地址按事件直接变 D |
| F49 | 05 | A | 从帧头已关闭保护，全部字段按各自写入事件变 A |
| F50 | 00 | A | 开启过渡，A |
| F51 | 00 | A | 完整参考，A |
| F52 | 00 | B | A，B 第一次 |
| F53 | 03 | B | A，B 第二次 |
| F54 | 0F | B | B，B 第三次 |
| F55 | 00 | C | B，C 第一次 |
| F56 | 00 | C | B，C 第二次 |
| F57 | 05 | D | 00-06 和 08 均保持 B；09 及后续地址按写入事件直接变 D |
| F58 | 05 | D | 全帧直接写 D，00-06 也必须变 D |
| F59 | 05 | D | D，直接写保持和完整尾帧 |

- 0x06/0x07/0x08 同属 CHPI beat 3，沿前同时取样。因此切换为 05 的那个沿，0x08 仍受旧模式保护；从 beat 4 的 09/0A 起按关闭后的模式直接写。0x07 自身在写入后等于新编码，不能按数值地址顺序把同沿的 08 当作下一次写入，也不能用最终 mode 解释整帧。
- F48/F57 帧末是按地址划分的混合生效配置，不应错误期待整组 D。F49/F58 要检查每地址即时生效，不能只检查帧末。
- F52-F54 说明非 5 编码之间切换不重启匹配进度，同时验证 07 不参与 XOR。
- F50-F54 证明关闭前状态不残留；F55-F58 检查尚未满足三帧时退出保护。
- 所有模式使用同一个不受保护使能门控的配置帧边界事件。

## 旧 case 覆盖对应

- 原 checksum_pwrc*_longtest、checksum_vbk_en_longtest 中逐帧变动非 0101 CHECKSUM 编码的内容，改为全 16 编码及跨编码连续匹配检查。
- 默认 0000 的覆盖与旧 CTRLF_CHECKSUM0 的控制字段意图一起纳入。

多寄存器组会逐字段比较，不能只检查 XOR 相等。单地址校验参与性由同模式 boundary case 承担；所有 case 合起来完成替代，不声称任意单个 case 就覆盖全部旧回归。

## 通过条件和实施检查

- 16 个编码都实际写入，每个开启编码都有保持/提交证据。
- 两次关闭边界、一次重开、开启编码之间两次切换都有独立值比较。
- 核对该模式全部目标字段在输入中确有变化、期望中有对应、实际比较没有遗漏；不出现 R_R_ 等重复前缀。
- 全部计划槽位与有效配置帧被计数，缺尾帧或场景未运行必须失败。
- 提交时间、实际寄存器值、0x27 特殊路径均按独立期望检查，不能因 DUT 没发 update_en 而跳过应提交帧。
- 本 case 已实现，完整 UVM 编译、DUT 仿真、首帧接收对齐及最终旧覆盖替代核对待执行。扩展地址范围、0x27 特殊路径及非 5 编码语义仍沿用已批准计划的假设，不能以实现核对代替完整规格确认。

## 参考文件

- [env_cfg.sv](../../agents/isprx_env/env_cfg.sv)：当前两模式字节打包映射。
- [checker_for_checksum.sv](../../agents/isprx_env/isptx_agent/checker_for_checksum.sv)：旧地址、层次及兼容行为参考；不沿用 DUT update_en 驱动 loaded 期望的方式。
- [t_8b1lane](../t_8b1lane/)：发送流程与环境基线。
- 本对话提供的寄存器截图及用户确认的一帧多寄存器合并要求。

## 实施文件与运行方法

- 独立安装器：`../../generate_t_8b1lane_checksum_mode_chip0.py`，内嵌全部68份文件，无需commit case或其他Python文件。
- 生成：test、局部`checksum_mode_sequence.sv`、include的`checksum_checker.sv`、`cfg_frame0.txt`至`cfg_frame59.txt`和编译/波形/README入口。`FRAME_NUM=59`，初始cfg0加59个图像帧末配置，共60次CTRL_F；不生成cfg60或PPM。
- checker沿用commit case的14个active、13个shadow及payload读取结构；本case使用独立`CS_INPUT`、`CS_MODE`、`CS_COMMIT`帧表，逐beat维护期望字节，比较写入前保持及写入后结果。0x07同沿切换按上述beat规则处理，不读取DUT的mode/update/match/unlock来决定期望。
- 完整性要求：60个配置帧、16个实际接收的控制编码，以及帧表指定的16个保护提交检查点均完成且无比较错误；提交检查点计数不是DUT提交脉冲计数。一个总超时覆盖sequence/checker结束。
- 服务器执行：`python3 generate_t_8b1lane_checksum_mode_chip0.py --dv-top /path/to/DV_TCON_C/top`；然后`./run_tc.sh TOP t_8b1lane_checksum_mode_chip0 chip_tb_top 1 clean`。
- 不修改env_cfg、RTL、共享agent或其他case，回归表只新增本case。已有验证计划在安装时保留。

## 本地实施核对

- Python语法编译和Python3.9 AST通过；68份安装内容与生成目录逐字一致，源代码及生成文件为ASCII，无未替换标记或重复信号前缀。
- 60份cfg逐字段独立打包与原始字节表一致；16种编码全覆盖，15组各三次保护配置加F54跨编码提交，共16个计划提交检查点；XOR为12/0E/EB/DB。
- 按独立逐帧生效表核对60帧，并核对F48/F57的0x08同沿保持、后续地址直接写入；156行checker包含14个active、13个shadow和控制字节/接收payload比较。此核对是Python推演，未执行SV checker。
- 仅复制单个py到临时DV树可安装；重复安装零文件改写、回归唯一、原计划和环境文件保持、无PPM。
- UVM编译、DUT仿真、首帧接收对齐及波形验收仍需服务器执行。
