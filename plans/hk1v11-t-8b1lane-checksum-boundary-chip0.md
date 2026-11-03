# t_8b1lane_checksum_boundary_chip0 Verification Plan

## 状态、运行条件和帧数

- 状态：已生成SV、55份实际配置及独立Python安装器；Python、配置/帧表、规格复位值和独立安装静态核对通过。F47为纯复位/训练槽位，完整UVM编译和DUT仿真待执行。
- 固定 CHIP_SEL=0；基于 t_8b1lane，通过现有 CHPI sequence 发送全部配置。每帧可同时写多个目标字段，不 force 被测寄存器。
- 本 case 计划 **56 个配置帧槽位**，F0 起计。有效配置帧、开启过渡帧、复位恢复槽位在表中区分；半帧不能算作三帧匹配样本。
- 八个 case 预算：commit 20+20、mode 60+60、unlock 24+24、boundary 56+64，共 **328 帧槽位**。若链路重锁需额外槽位，实施时显式统计并更新 FRAME_NUM、cfg 和 checker 索引；不得裁掉场景凑预算。
- env_cfg.sv不修改，不生成PPM；延续之前checksum case的单lane常量图像帧发送，每帧完整VBP/VACT/VFP以及HBP/HACT/HFP，复用既有training/LSP/CTRL_L/CTRL_F编码。仅最后一条VACT行末携带下一组CTRL_F，不加速帧间配置。
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

## F0-F38：逐地址隔离，合并覆盖八个 XOR bit

F0 A/5 直接建立基线，F1 A/0 为开启过渡，F2 A/0 为完整参考。

P 为上一组已提交向量，初始 P=A。每组 V 从 P 复制，仅执行 `V[addr]=P[addr]^mask`，连续三帧发 V。前两帧保持 P，第三帧提交 V；然后 P=V，开始下一地址。每组三帧只有一次失配，不触发 NG unlock。

| 帧 | 唯一变化地址 | mask | 合法字段 | 生效期望 |
| --- | --- | --- | --- | --- |
| F3-F5 | 0x00 | 0x80 | AVE_RGBW[2] | P,P,V |
| F6-F8 | 0x01 | 0x80 | AVE_LAST | P,P,V |
| F9-F11 | 0x02 | 0x01 | sw_reg_lane_ctrl3 | P,P,V |
| F12-F14 | 0x03 | 0x02 | sw_reg_lane_ctrl2 | P,P,V |
| F15-F17 | 0x04 | 0x40 | SD_CHOP[1] | P,P,V |
| F18-F20 | 0x05 | 0x20 | CH_SEL[0] | P,P,V |
| F21-F23 | 0x06 | 0x04 | DPLC_MODE | P,P,V |
| F24-F26 | 0x08 | 0x08 | TP_CONTROL | P,P,V |
| F27-F29 | 0x1D | 0x04 | SP_S[2] | P,P,V |
| F30-F32 | 0x1E | 0x10 | VBK[4] | P,P,V |
| F33-F35 | 0x1F | 0x40 | PWRC_N3 | P,P,V |
| F36-F38 | 0x27 | 0x80 | ACS_EN | P,P,V |

- 掩码覆盖 01/02/04/08/10/20/40/80，不做地址×bit×场景全交叉。
- 上一组已经稳定；若当前地址漏算 XOR，DUT 可能第一帧就提交 V。checker 仍期待 P，可直接检出漏算。
- CH_SEL 从 001 变为 000，均为合法配置；停止普通像素行数比较，不改变控制帧传输时序。
- 0x09/0x0A 为本模式保留字节固定零，不宣称覆盖任意保留位的可写性或校验参与性。
- 最后 P 的离线 XOR 为 A9，非零。

## F39-F41：不同配置、相同 XOR

X 从 P 复制，同时翻转 0x08[0] reg_eq_rbc0 和 0x1E[0] VBK[0]。相同位异或抵消，xor(X)=xor(P)。前面已有稳定匹配历史，所以第一帧就应在末字节完成时提交 X；不得误要求字段内容相同三帧。

| 帧 | 输入 | 帧末期望 |
| --- | --- | --- |
| F39 | X | X；末字节之前仍为 P |
| F40 | X | X |
| F41 | X | X |

## F42-F44：正常运行中的零 XOR

Z 从 X 复制，令 `Z[0x1E]=X[0x1E]^xor(X)`，得到 xor(Z)=0。之前的参考非零，因此仍需三帧。

| 帧 | 输入 | 帧末期望 |
| --- | --- | --- |
| F42 | Z | X |
| F43 | Z | X |
| F44 | Z | Z |

## F45-F50：累计两帧后复位，零 XOR 启动

Q 从 Z 复制，只翻转 VBK[1]，xor(Q)=02。

| 帧槽位 | 输入/动作 | 独立生效期望 |
| --- | --- | --- |
| F45 | Q，第一次 | Z |
| F46 | Q，第二次 | Z |
| 两槽位之间 | 完整芯片复位，重新锁定 CHPI | reset_expected 常量，旧匹配状态清除 |
| F47 | 为复位/链路恢复预留，不计作完整保护参考帧 | 不能偷发完整零 XOR 配置给测试预热 |
| F48 | 第一完整保护帧 Z | reset_expected |
| F49 | 第二完整保护帧 Z | reset_expected |
| F50 | 第三完整保护帧 Z | Z |

reset_expected 来自确认的当前规格复位常量，不假定全零，也不能读 DUT 作为初值。此处专门检查复位校验参考恰为零时是否错误提前通过。

若首次开启只能在传输中途生效，必须在恢复槽位中明确完成链路对齐；半帧不能算作完整样本，更不能在第一被测 Z 之前先送一个完整 Z 种子帧。恢复是否需要额外槽位在实施时核实并更新预算。若零 XOR 首帧行为与截图三帧规则冲突，记录规格/实现差异，不修改期望适配 DUT。

## 后续：非参与字段及当帧最后一个字节

STR=0x22[6] 作为不参与此校验集合的对照字段，避免使用 FSEL/CR 类字段改变时钟或锁定条件。T 从 Z 复制，仅翻转 0x27[1] Level_Skip_frame，xor(T) 不再为零。

| 帧 | 输入 | 独立生效期望 |
| --- | --- | --- |
| F51 | Z，STR=1 | Z；STR 在 0x22 写入时直接变 1 |
| F52 | Z，STR=0 | Z；STR 直接变 0 |
| F53 | T | Z，末字节变化第 1 帧 |
| F54 | T | Z，第 2 帧 |
| F55 | T | T，第 3 帧提交并结束 |

STR 逐帧改变不应打断受保护组的匹配，同时必须在自身地址直接生效。T 第三帧提交证明末字节使用当帧数据参与判断，没有漏算、漏更新或延迟一帧；0x27 无 shadow，仍要与独立 T 字段比较。

## 旧 case 覆盖对应

- 补原 PWRC/VBK_EN/ACS_EN/SDC 目标地址的独立参与性检查，保留位地址明确区分。
- 补默认开启路径的零 XOR、同 XOR、复位及末字节边界；不把它说成图像 CRC 验证。

多寄存器组会逐字段比较，不能只检查 XOR 相等。单地址校验参与性由同模式 boundary case 承担；所有 case 合起来完成替代，不声称任意单个 case 就覆盖全部旧回归。

## 通过条件和实施检查

- 12 个合法字段地址均有隔离检查，8 个 XOR bit 全部覆盖。
- 相同 XOR 时第一帧正常提交，零 XOR 正常三帧提交，复位后旧两帧记录不延续。
- reset_expected 和首个完整保护帧对齐是实施核对项，不以实际值自初始化掩盖差异。
- 核对该模式全部目标字段在输入中确有变化、期望中有对应、实际比较没有遗漏；不出现 R_R_ 等重复前缀。
- 全部计划槽位与有效配置帧被计数，缺尾帧或场景未运行必须失败。
- 提交时间、实际寄存器值、0x27 特殊路径均按独立期望检查，不能因 DUT 没发 update_en 而跳过应提交帧。
- 本case已实现，复位声明字段从20261012寄存器表核对；扩展参与集合仍沿用原计划假设，完整UVM编译/DUT仿真、正常图像帧传输及复位后对齐待确认。

## 参考文件

- [env_cfg.sv](../../agents/isprx_env/env_cfg.sv)：当前两模式字节打包映射。
- [checker_for_checksum.sv](../../agents/isprx_env/isptx_agent/checker_for_checksum.sv)：旧地址、层次及兼容行为参考；不沿用 DUT update_en 驱动 loaded 期望的方式。
- [t_8b1lane](../t_8b1lane/)：发送流程与环境基线。
- 本对话提供的寄存器截图及用户确认的一帧多寄存器合并要求。

## 实施文件、复位来源与发送预算

- 独立安装器：`../../generate_t_8b1lane_checksum_boundary_chip0.py`，内嵌63份文件，包括test、局部`checksum_boundary_sequence.sv`、include的`checksum_checker.sv`、55份cfg及编译/波形/README；安装时保留本计划，回归只新增本case。
- 56个槽位对应55次实际CTRL_F，F47只复位和重新训练，无cfg_frame47，不发送隐藏cfg。FRAME_NUM=54是真实图像帧数：复位前46帧、复位后8帧；初始cfg0单独发送，cfg1~46及cfg48~55分别在54个图像帧的最后VACT行末发送。局部body保留训练控制以避免重训后自动插入cfg0。
- 正常训练/LSP后发初始cfg0，再发送完整正常图像帧；VBP中的CTRL_L自然提供K1。复位后重新训练/LSP，从完整VBP/VACT/VFP帧开始，cfg48(Z)只在该帧最后VACT行末发送，无额外CTRL_F预热。复位前CTRL_L元数据沿用cfg_id-1，复位后使用cfg48~55，避免读取不存在的cfg47。checker仍检查正常CHPI和K1对齐。
- 承载cfg46的图像帧完成VFP、旧response排空后，仅force外部XPONRST_I低1us。checker收到reset-active事件时检查固定默认值并应答，发送端才拉高并release外部引脚后重训；不force内部寄存器或校验计数。一个总超时，退出时release外部引脚。
- 复位来源：`C:/Users/xiapeng2/Desktop/HK1V11/05.Register/HK1V11_Register_20261012.xlsm`的`Reg_description_F_CHIP_SEL=0`；PORSD F8=0、CH_SEL F24=011、SDC F26=1，VBK F63=0、1F F64:F71均0、STR F86=0，27的Skip/Level/ACS默认均0。
- 声明字段默认字节为00/00/00/00/00/60/02/00/00/00/00/00/00/00（按CS_ADDR顺序），不是全零。未定义默认的保留位在复位检查及首次完整提交前使用明确mask；09/0A全保留、04[0]及06[7]默认未完整给出，不假定其复位常量。payload和已写shadow仍全字节比较；首次完整提交后active恢复全字节比较。
- 结束要求：55次配置、一次复位检查、16个计划改变配置的提交检查点全完成且无比较错误；计数表示检查进度，不是DUT提交脉冲数。
- 使用：`python3 generate_t_8b1lane_checksum_boundary_chip0.py --dv-top /path/to/DV_TCON_C/top`，随后`./run_tc.sh TOP t_8b1lane_checksum_boundary_chip0 chip_tb_top 1 clean`。

## 已识别的零XOR启动差异

当前LC_CPUWR的prev_xsum_a复位为0，match_cnt_a为一位；静态逻辑显示首帧零XOR可能已算一次match，第二帧就提交。规格要求连续三帧才提交，因此F48/F49仍期待复位值、F50才期待Z。保留严格golden，不添加零XOR种子配置绕过，也不将RTL当前行为当作期望。是否实际复现及最终规格解释需服务器波形/设计确认。

## 本地实施核对结果

- Python语法编译及Python3.9 AST、63份模板与生成文件逐字一致/ASCII/无残留标记、55份cfg独立字段打包通过。
- 12地址单独变化、八个XOR bit、P/X=A9且字段不同、Z=00、Q/T=02、16个计划改变组提交点及所有55个配置的逐beat/整帧期望核对通过；复位槽没有cfg47，K1、重训、旧response排空和复位握手的静态顺序检查通过。
- 复位默认值和缺省保留位mask按20261012表格逐单元核对通过；checker信号在当前LC_CPUWR存在，golden不依赖DUT match/update/unlock。
- 单个py复制到临时DV树tests目录可独立安装，重复安装零改写、原计划/环境/回归保留及无PPM核对通过。
- 本地可选pyslang语法解析器因DLL加载失败不可用，未把SV语法或UVM编译算作通过。实际正常帧时序、复位后首帧对齐和零XOR第二帧提前提交风险需服务器仿真/波形确认。

- FRAME_NUM已按用户要求从占位1恢复为实际54、DV=0；公共scoreboard数组尺寸为54，运行时图像checker仍关闭。发送节奏由54个完整正常帧决定，不能再以快速连续CTRL_F代替。

## 正常帧节奏修正

按用户要求取消32-packet快速维护块，逐行发送任务与unlock_chip0保持相同公式：HBP=`hbp*3/port_num-9`、HACT=`hact*3/port_num`、HFP=`hfp*3/port_num-4`，有效区数据Gray64、消隐区Gray16。每帧VBP=4/VACT=16/VFP=5，HACT=3840/HBP=200/HFP=360，与此前checksum case一致。复位前46帧、复位后8帧，实际54帧、55次配置；cfg、checker及全部边界golden保持不变。不生成或读取PPM，不改公共环境。

静态核对：逐行任务与unlock_chip0模板仅配置索引接口不同，其余逐字一致；H/V参数相同，54帧×25行=1350行、仅54条最后VACT行携带新CTRL_F，加初始cfg0共55次。cfg与checker逐字保持，复位在承载cfg46的完整VFP后进行，重训后首个正常帧末才发送cfg48，无cfg47或预热CTRL_F。Python3.9语法、模板一致和独立/重复安装核对通过；UVM/DUT实际帧间隔和波形待服务器确认。

## 服务器截图诊断及无关文件告警修正

截图显示data_merge_scoreboard.sv:70对NULL句柄执行fscanf大量告警，同时checksum_checker在F49报告多个active寄存器已为Z（00=80、01=A0、02=01、03=02、04=40、05=00、06=06、08=09）而期望仍为复位值。此特征与零XOR复位后第二帧提前提交一致；需结合F47/F48日志和prev_xsum_a/match_cnt_a/frame_end_a/update_en_a波形排除复位失败或帧对齐问题，不把截图当作已完成根因波形定位。保持F48/F49复位、F50提交Z的规格期望。

公共data_merge_check_on=0只屏蔽比较/fatal，write_dump仍无条件write_ppm/get_cmodel，文件缺失后继续fscanf。仅在本case的test中通过实例factory override替换uvm_test_top.sd_env.ck_agent.rx_data_merge_mon_0，覆写sample_out_data_dump_aport_dump为空，使已经关闭的图像采样不产生事务，从而不触发无关文件读写。公共monitor/scoreboard文件不改，checksum checker、55份cfg和54帧正常发送时序均保持，Python同步内嵌。
