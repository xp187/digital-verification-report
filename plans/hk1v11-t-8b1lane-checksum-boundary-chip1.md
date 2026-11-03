# t_8b1lane_checksum_boundary_chip1 Verification Plan

## 状态、运行条件和帧数

- 状态：已生成 SV、63 份 cfg 和独立 Python 安装器，并完成配置及安装静态核对；未运行 UVM 编译或 DUT 仿真。
- 固定 CHIP_SEL=1；基于 t_8b1lane，通过现有 CHPI sequence 发送全部配置。每帧可同时写多个目标字段，不 force 被测寄存器。
- 本 case 计划 **64 个配置帧槽位**，F0 起计。有效配置帧、开启过渡帧、复位恢复槽位在表中区分；半帧不能算作三帧匹配样本。
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
| 0x1F | 00 | FF | 00 | AA |
| 0x27 | 00 | 80 | 00 | 80 |

按候选参与集合计算，A/B/C/D 的 8-bit XOR 为 **12 / 42 / 27 / 5B**，四者非零且互不相同。实施时由生成器独立复算，不能取 DUT 的校验结果。

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

## F0-F44：逐地址隔离，合并覆盖八个 XOR bit

F0 A/5 直接建立基线，F1 A/0 为开启过渡，F2 A/0 为完整参考。

P 为上一组已提交向量，初始 P=A。每组 V 从 P 复制，仅执行 `V[addr]=P[addr]^mask`，连续三帧发 V。前两帧保持 P，第三帧提交 V；然后 P=V，开始下一地址。每组三帧只有一次失配，不触发 NG unlock。

| 帧 | 唯一变化地址 | mask | 合法字段 | 生效期望 |
| --- | --- | --- | --- | --- |
| F3-F5 | 0x00 | 0x80 | AVE_RGBW[2] | P,P,V |
| F6-F8 | 0x01 | 0x80 | AVE_LAST | P,P,V |
| F9-F11 | 0x02 | 0x04 | SMART_CS[0] | P,P,V |
| F12-F14 | 0x03 | 0x02 | sw_reg_lane_ctrl2 | P,P,V |
| F15-F17 | 0x04 | 0x40 | SD_CHOP[1] | P,P,V |
| F18-F20 | 0x05 | 0x20 | CH_SEL[0] | P,P,V |
| F21-F23 | 0x06 | 0x04 | DPLC_MODE | P,P,V |
| F24-F26 | 0x08 | 0x08 | TP_CONTROL | P,P,V |
| F27-F29 | 0x09 | 0x01 | SR_PR[0] | P,P,V |
| F30-F32 | 0x0A | 0x10 | PWRC_P[0] | P,P,V |
| F33-F35 | 0x1D | 0x04 | SP_S[2] | P,P,V |
| F36-F38 | 0x1E | 0x10 | VBK[4] | P,P,V |
| F39-F41 | 0x1F | 0x40 | PWRC_NB[0] | P,P,V |
| F42-F44 | 0x27 | 0x80 | ACS_EN | P,P,V |

- 掩码覆盖 01/02/04/08/10/20/40/80，不做地址×bit×场景全交叉。
- 上一组已经稳定；若当前地址漏算 XOR，DUT 可能第一帧就提交 V。checker 仍期待 P，可直接检出漏算。
- CH_SEL 从 001 变为 000，均为合法配置；停止普通像素行数比较，不改变控制帧传输时序。
- 0x09/0x0A 使用合法 SR/PWRC 字段，均有独立参与性测试。
- 最后 P 的离线 XOR 为 BD，非零。

## F45-F47：不同配置、相同 XOR

X 从 P 复制，同时翻转 0x08[0] reg_eq_rbc0 和 0x1E[0] VBK[0]。相同位异或抵消，xor(X)=xor(P)。前面已有稳定匹配历史，所以第一帧就应在末字节完成时提交 X；不得误要求字段内容相同三帧。

| 帧 | 输入 | 帧末期望 |
| --- | --- | --- |
| F45 | X | X；末字节之前仍为 P |
| F46 | X | X |
| F47 | X | X |

## F48-F50：正常运行中的零 XOR

Z 从 X 复制，令 `Z[0x1E]=X[0x1E]^xor(X)`，得到 xor(Z)=0。之前的参考非零，因此仍需三帧。

| 帧 | 输入 | 帧末期望 |
| --- | --- | --- |
| F48 | Z | X |
| F49 | Z | X |
| F50 | Z | Z |

## F51-F56：累计两帧后复位，零 XOR 启动

Q 从 Z 复制，只翻转 VBK[1]，xor(Q)=02。

| 帧槽位 | 输入/动作 | 独立生效期望 |
| --- | --- | --- |
| F51 | Q，第一次 | Z |
| F52 | Q，第二次 | Z |
| 两槽位之间 | 完整芯片复位，重新锁定 CHPI | reset_expected 常量，旧匹配状态清除 |
| F53 | 为复位/链路恢复预留，不计作完整保护参考帧 | 不能偷发完整零 XOR 配置给测试预热 |
| F54 | 第一完整保护帧 Z | reset_expected |
| F55 | 第二完整保护帧 Z | reset_expected |
| F56 | 第三完整保护帧 Z | Z |

reset_expected 来自确认的当前规格复位常量，不假定全零，也不能读 DUT 作为初值。此处专门检查复位校验参考恰为零时是否错误提前通过。

若首次开启只能在传输中途生效，必须在恢复槽位中明确完成链路对齐；半帧不能算作完整样本，更不能在第一被测 Z 之前先送一个完整 Z 种子帧。恢复是否需要额外槽位在实施时核实并更新预算。若零 XOR 首帧行为与截图三帧规则冲突，记录规格/实现差异，不修改期望适配 DUT。

## 后续：非参与字段及当帧最后一个字节

STR=0x22[6] 作为不参与此校验集合的对照字段，避免使用 FSEL/CR 类字段改变时钟或锁定条件。T 从 Z 复制，仅翻转 0x27[1] Level_Skip_frame，xor(T) 不再为零。

| 帧 | 输入 | 独立生效期望 |
| --- | --- | --- |
| F57 | Z，STR=1 | Z；STR 在 0x22 写入时直接变 1 |
| F58 | Z，STR=0 | Z；STR 直接变 0 |
| F59 | T | Z，末字节变化第 1 帧 |
| F60 | T | Z，第 2 帧 |
| F61 | T | T，第 3 帧提交 |
| F62 | T | T，稳定 |
| F63 | T | T，稳定并结束 |

STR 逐帧改变不应打断受保护组的匹配，同时必须在自身地址直接生效。T 第三帧提交证明末字节使用当帧数据参与判断，没有漏算、漏更新或延迟一帧；0x27 无 shadow，仍要与独立 T 字段比较。

## 旧 case 覆盖对应

- 补原 SR_PR/SMART_CS 的目标地址隔离，增加本模式 PWRC 的 0x0A/0x1F。
- 零 XOR、同 XOR、复位、非参与字段和末字节为旧普通/longtest 的补充。

多寄存器组会逐字段比较，不能只检查 XOR 相等。单地址校验参与性由同模式 boundary case 承担；所有 case 合起来完成替代，不声称任意单个 case 就覆盖全部旧回归。

## 通过条件和实施检查

- 14 个合法字段地址均有隔离检查，8 个 XOR bit 全部覆盖。
- 相同 XOR 时第一帧正常提交，零 XOR 正常三帧提交，复位后旧两帧记录不延续。
- reset_expected 和首个完整保护帧对齐是实施核对项，不以实际值自初始化掩盖差异。
- 核对该模式全部目标字段在输入中确有变化、期望中有对应、实际比较没有遗漏；不出现 R_R_ 等重复前缀。
- 全部计划槽位与有效配置帧被计数，缺尾帧或场景未运行必须失败。
- 提交时间、实际寄存器值、0x27 特殊路径均按独立期望检查，不能因 DUT 没发 update_en 而跳过应提交帧。
- 本 case 已按本计划实现。复位声明字段已按 20261012 表核实；扩展地址集合、0x27 与 NG unlock 的完整规格确认、实际 CHPI 对齐、UVM 编译及 DUT 仿真仍待完成。

## 参考文件

- [env_cfg.sv](../../agents/isprx_env/env_cfg.sv)：当前两模式字节打包映射。
- [checker_for_checksum.sv](../../agents/isprx_env/isptx_agent/checker_for_checksum.sv)：旧地址、层次及兼容行为参考；不沿用 DUT update_en 驱动 loaded 期望的方式。
- [t_8b1lane](../t_8b1lane/)：发送流程与环境基线。
- 本对话提供的寄存器截图及用户确认的一帧多寄存器合并要求。

## 实施文件与正常帧发送方式

- 独立安装器：`../../generate_t_8b1lane_checksum_boundary_chip1.py`，仅依赖 Python 3.9+ 标准库，内嵌 71 份文件：test、sequence、include checker、user_def、test_lib、test.f、waves_dumper、README 和 63 份 cfg。安装保留本计划，回归只新增本 case，不修改 env_cfg、公共 driver、RTL 或 TB。
- 64 个槽位中 F53 只作外部引脚复位和链路重训，没有 cfg_frame53。实际 CTRL_F 次数为 63，完整图像帧为 62：复位前 52 帧、复位后 10 帧，`FRAME_NUM=62`、`DV=0`。
- 初始 cfg0 在首次训练/LSP 后发送一次；cfg1～52 与 cfg54～63 仅在完整图像帧的最后 VACT 行末发送。H/V 参数沿用其他 checksum case：HACT=3840、HBP=200、HFP=360、VBP=4、VACT=16、VFP=5；活动区 Gray64，消隐区 Gray16。不生成或读取 PPM。
- 承载 cfg52 的图像帧完成 VFP、排空旧 response 后，force 外部 `XPONRST_I` 低 1us。checker 检查固定默认值并应答后才拉高、release 该引脚并重训。不 force 目标寄存器或校验控制。重训后首个完整帧末才发 cfg54，没有隐藏 CTRL_F 种子帧。
- checker 使用独立 `CS_VALUE[64][14]` 和固定提交表；14 组隔离在 F5/8/11/14/17/20/23/26/29/32/35/38/41/44 检查第三帧提交；后续改变配置的提交点为 F45/F50/F56/F61。结束必须完成 63 次配置、一次复位和 18 个改变配置的提交检查点，且错误数为零。此计数表示计划检查进度，不取 DUT 提交脉冲作期望。
- `0x22[6] STR` 在 F57/F58 分别为 1/0，按自身 beat 直接检查；F62/F63 稳定尾帧仍逐 beat 比较。每个 beat 同时检查写入 payload、对应 shadow、旧生效值与写后生效值，默认采用四态比较。

## CHIP_SEL=1 复位默认值与检查位置

- 来源：`C:/Users/xiapeng2/Desktop/HK1V11/05.Register/HK1V11_Register_20261012.xlsm`，`Reg_description_F_CHIP_SEL=1`。SR 四项 F41:F44 均为 11，故 09=FF；F45:F48 的 TA/TB/P/N 为 01/01/10/10，故 0A=A5；F70:F73 的 PA/PB/NA/NB 均为 10，故 1F=AA。CH_SEL F24=011、SDC F26=1，其余声明字段和保留位 mask 分开处理。
- 当前 RTL 的 09/0A/1F 原始存储和 shadow 复位为 00，规格有效字段由 `LC_REG_MAPPING` 重建，并接回 CPU 的 `R_REG09_F_RECON`、`R_REG10_F_RECON`、`R_REG31_F_RECON`。这三个地址的 active 比较使用重建字节，其余地址使用 `R_REGxx_F`；复位 shadow 比较使用固定原始存储复位常量 00。规格默认值不会从 DUT 读出后作为期望。
- 复位后保护尚未提交时，这三个地址的有效字段必须保持 FF/A5/AA；若 write flag 提前切到原始存储而导致默认值改变，checker 会报 active 失配。不能把“收到了新配置”当作允许提前改变有效输出的理由。
- 延续 chip0 的严格零 XOR 规则：F54/F55 保持复位值，F56 才提交 Z。此前发现的零 XOR 第二帧提前提交仍按错误报告，不添加预热帧或放宽 golden。需将其与重建默认值提前变化、复位失败、K1 对齐问题分别看波形确认。

## 本地核对与使用

- Python py_compile、Python 3.9 AST、71 份嵌入文件与生成文件一致、ASCII/无残留模板标记、63 份 cfg 独立字段打包均通过。
- 逐地址/bit/同 XOR/零 XOR/复位/STR/末字节与稳定尾帧表已核对；实际读取的 CPU 信号在当前 RTL 中存在，期望不依赖 match/update/unlock。
- 单个 py 复制到临时 DV 树的 tests 目录即可安装；重复安装和显式 `--dv-top` 安装均零改写。原计划、环境、TB 和既有回归项保留，新增回归项唯一，无 PPM。
- 核对脚本与临时安装证据：`C:/Users/xiapeng2/AppData/Local/Temp/checksum_boundary_chip1_validation_98ceeb74`。这些是生成与安装核对，不代表实际 CHPI/UVM/DUT 已通过。
- 使用：`python3 generate_t_8b1lane_checksum_boundary_chip1.py --dv-top /path/to/DV_TCON_C/top`，随后 `./run_tc.sh TOP t_8b1lane_checksum_boundary_chip1 chip_tb_top 1 clean`。
