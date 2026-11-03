# EOL 三字段联合功能验证计划

## 1. 交付目标与当前状态

- Case 名称：`t_8b1lane_EOL_CTRL`。
- 验证对象：`reg_eol`、`reg_eol_det`、`reg_pin_eol_det` 三个字段。
- 采用一个多阶段 case、一个被动 checker；发送类如有必要，放在主 test 文件中，不额外拆独立 sequence 文件或增加 vseq 包装。
- 已实现配置、主 test、单 checker 和安装器，已登记回归，并将 TEST12 接入默认低电平 TB 驱动变量。完整 UVM/DUT 编译和仿真仍待内网执行。
- 目标是验证三字段的核心联合功能、引脚/寄存器选择和可逆恢复；不等同于完成所有协议、所有位组合及模拟输出回归。

## 2. 依据、地址与复位条件

以当前 `cmodel/test/HV2A31/HDL` 为准，不使用旧的同名参考树来确定层次。

寄存器说明来自本地寄存器导航的 `HK1V11_Register_20261012.xlsm` 提取数据；RTL 使用 `HDL/file_list/HK1V11_digital_top.f` 和 `HDL/HK1V11_digital_top/LOGIC_CENTER.f` 指定的文件。

| 字段 | 地址 | 默认值 | 规格功能 |
| --- | --- | --- | --- |
| reg_eol | 0x38[6] | 0 | 短编码应用：0为DE by counter，1为DE by EOL |
| reg_eol_det | 0x38[5] | 0 | 选择寄存器控制时，0关闭、1开启EOL检测 |
| reg_pin_eol_det | 0x38[4] | 1 | 0选择寄存器，1选择外部引脚控制EOL检测 |

三字段受 `LSI_PRTECT` 的输出选择保护。解锁前有效输出回退至默认值，不把该状态误判成写入失败。每阶段通过正常 CHPI 写入 `TEST_PRTCT=0x72`，并核对实际解锁；固定 `CTRLF_CHECKSUM=0101`，避免配置延后提交。

`0x38[3:0]` 是其他 UTC 字段，发送配置时保留已知合法背景值，不能为了改三字段而误改邻位。阶段表只表示 `[6:4]`，不是整字节写值。

## 3. 已核实的逻辑路径

### 3.1 检测控制源

`HDL/HK1V11_digital_top/seperated_code/LC_REG_MAPPING.v:544`：

```verilog
assign eol_det_en = reg_pin_eol_det ? EOL_DET : reg_eol_det;
```

外部路径为 `TEST12 -> EOL_DET_I -> EOL_DET -> eol_det_en`。
期望值必须来自阶段计划的 TEST12 和寄存器配置，不能使用 DUT 的 eol_det_en 决定是否应该检查。

### 3.2 缺少 EOL 的 LENB 保护

`LENB_CTRL.v:69-84`：

- 仅在 `SP=1 && eol_det_en=1 && reg_eol=0` 时启用此项保护。
- 有效行条件 `R_BKDU=0` 且到达 `BIT_ALIGN_PT_DLY` 检查时刻后，根据 `K2_FIND | K3_FIND | K4_FIND` 决定 `LENB_ENABLE_1`。
- 检查时存在 EOL则置1；缺失则置0；非检查时刻保持。不能假设 K1 会把这一项自动清回1。
- 不满足保护使能组合时，`LENB_ENABLE_1` 应回到1。
- 最终 `LENB_ENABLE = rx_vcom_detect & LENB_ENABLE_0 & LENB_ENABLE_1 & LENB_ENABLE_2`。必须隔离 TBK、UTC 等其他屏蔽条件。

完整输出脉冲可能有流水延迟：必须先核对当前 DTCTL 的门控和流水，再把故障行映射到对应输出行。不能未经对齐就要求“注错行当场少一个 LENB”。

### 3.3 行结束和 STB 时序来源

`CHPI_SD_CTRL.v:153-185`：

- `SP=1、reg_eol=0`：`DATA_END_TIM`、`DATA_SYNC_TIM`、`TP_DLY_CNT0_START` 使用数据计数路径。
- `SP=1、reg_eol=1`：行结束与同步事件使用 `LONG_END_EVENT`，其来源包含 K2、K3，以及该模式下的 K4。
- `TP_DLY_LOAD` 同时切换到 EOL/长路径对应的装载值；不要要求两个模式的绝对STB延迟必然相等。
- 最终检查必须包含真实 STB 和左右 LENB，不能仅检查内部 mux 选择正确。

## 4. 固定背景和 TB 接入

- CHIP_SEL=0，8B/10B短编码，运行时确认 `SP=1`。
- 单lane，固定数据格式/通道数/HACT，8个有效图像帧，每帧VACT=16行；HBP/HFP预留足够空间供EOL移位，所有比较组保持相同行周期。
- 固定 `LD_R=5、LD_W=22、LD_F=0`。DPLC、AVE、scramble、ACS、VPS、TP测试等无关功能关闭或固定至现有稳定背景。
- 每帧显式设置稳定背景：`POL=0`、`PORSD=1`、`CH_SEL=001`、`TEST_PRTCT=0x72`、`CTRLF_CHECKSUM=0101`，并固定时序相关的 `LD_R=5`、`LD_W=22`、`LD_F=0`、`R_MASK_6PIX=0`、`AABB=00`、`LENB_SHIFT=00`；其余寄存器使用 `env_cfg` 已声明默认值。每份配置都包含本帧的三个EOL字段，避免只靠前一帧残留状态。
- 图像内容使用固定合法数据；不得形成TBK或意外K码，不依赖PPM。图像scoreboard如依赖外部图像则关闭，由本case输出检查判定功能。
- 训练/锁定及正常CHPI配置流程沿用现有环境，不force内部 `SP`、EOL事件、寄存器输出、LENB门控或STB。

`tb/chip_tb_top.sv` 将 TEST12 接到 `eol_det_drive`，变量默认 0；本 case 在每帧垂直消隐开始时驱动计划值，并在结束/超时收尾时恢复 0。其他 case 保持默认低电平，所有 DUT 仍共用原有 TEST12 连接。

TEST12在配置边界驱动并等待输入路径稳定；进入本档有效行前核对真实引脚值和内部EOL_DET。引脚未接通、X/Z或取值错误均属于配置/环境失败，不能作为功能跳过条件。

## 5. 八阶段配置表

所有阶段均通过CHPI明确写三字段与共同背景，不依赖前一档残留。F0至F7分别对应cfg_frame0至cfg_frame7，cfg_frame8重复F7设置，仅用于最后一帧收尾，不作为第九档。

| 阶段 | reg_eol | reg_pin_eol_det | reg_eol_det | TEST12 | 计划eol_det_en | 行内激励 | 验证目标 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F0 | 0 | 0 | 0 | 1 | 0 | 正常→缺失→恢复 | 寄存器关闭时，反向引脚不能开启检查 |
| F1 | 0 | 0 | 1 | 0 | 1 | 正常→缺失→恢复 | 寄存器开启时，反向引脚不能关闭检查 |
| F2 | 0 | 1 | 1 | 0 | 0 | 正常→缺失→恢复 | 引脚选择0时，反向寄存器不能开启检查 |
| F3 | 0 | 1 | 0 | 1 | 1 | 正常→缺失→恢复 | 引脚选择1时，反向寄存器不能关闭检查 |
| F4 | 0 | 0 | 0 | 0 | 0 | 正常→推迟→恢复 | 计数模式下行结束/STB不跟随EOL移动 |
| F5 | 1 | 0 | 0 | 0 | 0 | 正常→推迟→恢复 | EOL模式下行结束及实际STB跟随EOL移动 |
| F6 | 1 | 0 | 1 | 0 | 1 | 正常→推迟→恢复 | reg_eol=1时旁路计数模式EOL保护，迟到EOL不因旧计数检查点被屏蔽 |
| F7 | 0 | 1 | 0 | 0 | 0 | 正常→缺失→恢复 | 恢复三个默认字段和引脚低，检查计数输出及关闭保护恢复 |

F0/F1、F2/F3使用相反的寄存器值与引脚值，避免两控制源恰好相同导致选择错误也通过。F4/F5/F6使用相同数据、相同EOL移动量，比较时仅目标模式变化。

## 6. 每阶段的行内安排与注错方式

有效行采用0起始编号，固定安排如下：

| 有效行 | 用途 |
| --- | --- |
| 0～1 | 配置/流水准备，不纳入功能计数 |
| 2～4 | 3条正常EOL基线行 |
| 5～7 | F0～3/F7为3条EOL缺失行；F4～6为3条EOL推迟行 |
| 8～10 | 3条恢复正常EOL行，验证同阶段恢复 |
| 11～14 | 正常保护间隙和流水排空 |
| 15 | 保留正常K4+CTRL_F，发送下一档配置 |

### EOL 缺失

只在指定中间有效行替换实际发送的 K2 事务，以四个普通合法 8B/10B 数据符号占据同一位置，保持符号数、K1位置及行周期不变。TX driver 将一个 K2 sequence item 展开为线上 `K2/G2/G2/K2` 四个 10-bit 符号；因此必须替换四个符号，不能只替换一个而造成行周期缩短。K2 前的四次 `scramble` 仅推进 LFSR 状态，不是线上符号。不能只关闭 checker 观测，也不能删除 key 后缩短整行。

checker必须证实指定检查窗口内K2/K3/K4均未被识别，正常组与恢复组则确实收到合法EOL。不得破坏最后有效行的K4+CTRL_F，避免后续配置丢失或阶段错位。缺失EOL后若导致意外失锁或UTC/TBK屏蔽，应报告背景失败并定位，不能把这种LENB消失算作EOL保护通过。

### EOL 推迟

计划推迟量 `N=4 DCLK`。维持有效像素、K1和整行HTOTAL不变，把EOL向HFP内移，等量缩短剩余HFP空闲；不能通过移动下一行K1来制造表面上的延迟。

实现前核对当前驱动的符号数和DCLK换算。若每DCLK接收两个10-bit符号，4 DCLK对应8个符号槽；以实际配置确认后写成固定值，不临时读取DUT时序反推注错量。必须验证三条推迟行的解码EOL相对K1确实各后移4 DCLK，且下一K1间隔未改变。

正常与推迟EOL均须位于合法协议/行时序窗口内，并留足STB/LENB排空空间。

## 7. Checker 独立期望与检查层次

### 7.1 配置一致性

每阶段检查实际原始0x38存储的[6:4]、三路有效字段、LSI_PRTECT、CHECKSUM原始值及TEST12/EOL_DET。

```systemverilog
expected_det_en = planned_pin_select ? planned_test12 : planned_reg_det;
expected_guard = planned_short_mode && expected_det_en && !planned_reg_eol;
```

计划值是golden。不能用实际eol_det_en、LENB_ENABLE_1或STB是否出现，反过来决定当前应检查哪个阶段。

### 7.2 控制源选择

逐稳定采样比较 `eol_det_en` 与 `expected_det_en`。F0/F1必须由reg_eol_det决定，F2/F3必须由TEST12决定，非选中源取相反值也不能影响结果。

### 7.3 缺失保护和恢复

- F0/F2/F7：计数路径保持工作；正常、缺失、恢复组均不应因EOL缺失使LENB_ENABLE_1置0。左右输出完整脉冲数及宽度应保持同档基线。
- F1/F3：正常组检查通过；缺失组在对应BIT_ALIGN_PT_DLY有效检查点把LENB_ENABLE_1置0，并传递到最终LENB_ENABLE；实际输出出现与流水位置对应的屏蔽。恢复组在下一次合法EOL检查通过后恢复，不能假定下一K1自动恢复。
- 记录门控拉低、重新置1的DCLK编号，并按核实的流水关系对齐实际LENB输出。若前一正常行已在途，允许其正常完成；不能要求所有注错后的脉冲立即消失。
- 检查 `rx_vcom_detect=1、LENB_ENABLE_0=1、LENB_ENABLE_2=1` 等其他门控背景，排除TBK/UTC等原因。
- 每类至少3个有效检查事件。恢复pipeline需要的准备输出不得冒充3条完整恢复样本；必要时使用11～14行排空区补足，而不是降低样本要求。

### 7.4 计数模式与EOL模式

对各行以K1为时间基准，记录EOL、DATA_END_TIM、DATA_SYNC_TIM、TP_DLY_CNT0_START、STB上升/下降沿和最终左右LENB完整脉冲。

- F4：计划EOL后移4 DCLK，DATA_END_TIM/DATA_SYNC_TIM和实际STB相对K1的时刻均保持正常组基线；恢复组保持基线。
- F5/F6：DATA_END_TIM/DATA_SYNC_TIM应对应合法EOL事件，推迟组相对正常组后移4 DCLK；实际STB亦须正常产生并相应后移4 DCLK，同一模式内STB脉宽不变；恢复组回到该模式基线。
- F6：eol_det_en虽然为1，reg_eol=1仍要求LENB_ENABLE_1旁路为1，不能在旧计数行尾点误屏蔽迟到EOL对应输出。
- F7：恢复计数模式的输出时刻和完整LENB行为；对照F0/F4稳定正常组，不能沿用上一EOL模式的期望。
- 左右LENB都检查有效脉冲、宽度和预期门控；不强行要求左右波形在每一时刻相同，保留正常左右输出的固定关系。

比较差值仅使用有明确行号且完整捕获的同类事件；没有STB不能返回0延迟当作通过，正常组和推迟组都无脉冲也必须报错。若样本存在多个事件或配对不唯一，报告额外脉冲/匹配失败。

## 8. 信号观测点与边界处理

下列层次以 `chip_tb_top.u_HK1V11.u_HK1V11_digital_top` 为digital_top前缀；实现前再核对当时文件版本。

| 位置 | 主要信号 |
| --- | --- |
| TB/封装输入 | TEST12、EOL_DET_I |
| u_LOGIC_CENTER.LINK_LOGIC.LINK_CONFIG_CTRL.LC_CPUWR | R_REG56_F[6:4]、reg_eol、reg_eol_det、reg_pin_eol_det、LSI_PRTECT |
| LINK_CONFIG_CTRL.LC_REG_MAPPING | EOL_DET、eol_det_en |
| LINK_PANEL_CTRL.CHPI_SD_CTRL | SP、K1_FIND、K2_FIND、K3_FIND、K4_FIND、DATA_END_TIM、DATA_SYNC_TIM、TP_DLY_CNT0_START、TP_DLY_LOAD、STB_A/STB_B |
| LINK_PANEL_CTRL.LENB_CTRL | R_BKDU、BIT_ALIGN_PT_DLY、LENB_ENABLE_0/1/2、rx_vcom_detect、LENB_ENABLE |
| digital_top实际输出 | LENB_L、LENB_R；相关STB在当前真实生成位置观测 |

LINK_CONFIG_CTRL及LINK_PANEL_CTRL均位于u_LOGIC_CENTER.LINK_LOGIC下。输出名采用新版TOP的LENB_L/R，不能在封装层直接套用内部带_O的名字。

- 以正常发送流程的配置序号/提交事件按序识别八阶段，不用配置值首次匹配识别恢复档。
- CTRL_F可能在前帧末行即生效，必须丢弃跨配置行和跨边界输出，待本档配置及TEST12稳定后开始观测。
- 每行使用K1/协议行号关联激励与接收事件。允许固定流水延迟，但必须明确映射，不能把故障影响随意归给后一行以消除错误。
- 同步判断在时序更新和FF_DLY稳定后采样，输出完整脉冲分别捕获起止沿；不能仅低频抽样而漏掉短脉冲。
- 背景不满足须在有界准备窗口后报告配置/环境错误，不能一直跳过直到空跑结束。

## 9. 当前RTL需要保留的疑点

`CHPI_SD_CTRL.v:164` 中LONG_END_EVENT_D更新为 `~SP & LONG_END_EVENT`，但 `:185` 的短编码reg_eol=1会选择该信号作为TP_DLY_CNT0_START。SP=1时该延迟事件保持0，与“EOL驱动完整行结束及后续输出”的预期可能不一致。

F5/F6必须保留真实STB启动及输出检查。若DATA_END_TIM跟随EOL但没有STB，应单独报告TP启动链失败，保存K1、EOL、SP、reg_eol、LONG_END_EVENT_D、TP_DLY_CNT0_START及STB现场。不得把这一项写成expected=0、屏蔽阶段、修改golden去匹配RTL，或以缺少样本判PASS。

规格中明确的是DE by EOL；STB绝对延迟及pipeline对应关系仍需在实现时对照详细协议时序确认，不能只根据现有可疑路径推定设计意图。该疑点不妨碍先准备完整计划，最终通过前必须闭环。

## 10. 覆盖、错误报告与通过标准

必须统计并报告：

1. F0～F7全部完成，配置写入与TEST12切换正确，无遗漏或乱序。
2. F0～F3四种反向控制源组合各有至少3条正常、3条缺失和3条恢复有效事件；F7同样确认恢复。
3. F4～F6各有至少3对正常/推迟样本，实际推迟量4 DCLK且行周期不变；恢复样本不少于3条。
4. 保护开启/关闭、门控置0/恢复为1、真实左右LENB屏蔽/恢复、计数不跟随EOL与EOL模式跟随均有实际覆盖。
5. 无寄存器/引脚失配、X/Z、意外失锁、额外脉冲、宽度异常或任何辅助检查错误。
6. 每个等待点有上限；整case初拟10ms watchdog，实施时按实际训练和8帧时长核实预算。超时或观测不足一律失败。

错误消息至少包含stage、frame/line、三字段计划/实际值、TEST12、eol_det_en、EOL种类/实际时刻、BIT_ALIGN检查点、三项LENB门控、STB/LENB时刻及期望差值，输出英文日志。配置/环境错误与功能失配区分记录，但任一错误均禁止最终PASS。

## 11. 已实现内容与验证边界

本目录包含主 test（发送类内嵌）、被动 checker、cfg_frame0～8、user_def.sv、test.f、test_lib.sv、waves_dumper.sv、README 和详细计划。TB 使用默认低电平的 `chip_tb_top.eol_det_drive` 驱动 TEST12；安装器位于项目根目录。`regression/testname.f` 中 case 名称只登记一次。

发送端在 K1 前排入行描述，接收端按 K1 顺序配对。每档有3条基线、3条故障和3条恢复测量行，共72条；每帧末有效行保留 K4+CTRL_F。EOL 缺失行以一个合法数据符号替代一个 K2 事务，延迟行在 EOL 前增加8个符号、并从 HFP 扣回8个符号，以保持下一 K1 周期。

固定 `LD_R=5` 时，DTCTL 使用 `LENB_pre` 路径，而非由 STB 派生的 LENB1 路径；checker 因此分别检查 STB 的 EOL 时序和真实 LENB 的保护、恢复及脉宽。`LENB_SHIFT=00`、`AABB=00` 固定，短脉冲通过边沿捕获。当前可疑的 TP 启动路径仍保留检查：F5/F6 必须出现 TP_START 及完整 STB，缺失会报错。

本地可做的检查限于文件/配置一致性、回归唯一登记、驱动符号数和 Python 安装器语法/幂等性。完整 UVM/DUT 编译与仿真须在内网服务器执行；当前不据静态检查宣称 DUT 通过。`SP=0` 长编码、`CHIP_SEL=1`、mask/UTC/TBK 交叉、模拟输出和全部 EOL 编码组合不在本 case 范围。
