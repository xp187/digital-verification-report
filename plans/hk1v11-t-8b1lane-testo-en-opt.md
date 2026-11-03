# TESTO_EN_OPT 验证计划

## 1. 验证目标

验证正常工作、I_POFF_MODE=0 时，0x20[6] TESTO_EN_OPT 与外部 TEST2 输入异或，正确控制数字顶层的测试输出使能；固定一路会持续翻转的测试信号，检查开启有信号、关闭无信号。

```text
expected_enable = TEST2 XOR TESTO_EN_OPT
digital_top.TESTO_EN_L = expected_enable
digital_top.TESTO_EN_R = expected_enable
```

期望使能来自固定八组激励表，不使用 DUT 内部异或结果作为期望。

## 2. 固定配置

- 基于现有 8-bit、单 lane、12 ports、3840×16、8 帧传输，CHIP_SEL=1。
- TEST_PRTCT=0x72，CTRLF_CHECKSUM=0101，关闭三帧校验保护等待。
- 保持正常非省电状态，I_POFF_MODE=0；检查窗口内 DCLK 持续运行、复位已释放。
- R_TESTO_SEL=0x00，PWRC_TSEL=0，只改变同地址的 TESTO_EN_OPT。
- R_TESTO_SEL=0x00 选择默认监视组，其中 bit1 为 RECK0，对应 digital_top.TESTO_O2。
- RECK0 为 DCLK_DIV[3]，正常连续 DCLK 下每 8 个上升沿翻转一次，周期为 16 个 DCLK。
- 开启 data_merge、digital、analog checker，关闭 chopper checker；复用已有 pattern，不生成 PPM 或 ctrl_l_line_cfg.txt。

本 case 不遍历 R_TESTO_SEL 选择表，不测省电覆盖、错误保护密码或模拟 PAD 电气特性。

## 3. 八帧激励

| 配置组/帧 | TEST2 | TESTO_EN_OPT | 两路使能期望 | TESTO_O2 检查 |
| ---: | :---: | :---: | :---: | --- |
| 0 | 0 | 0 | 0 | 32 个 DCLK 始终为 0 |
| 1 | 0 | 1 | 1 | 32 个 DCLK 内采到 0、1，并出现翻转 |
| 2 | 1 | 1 | 0 | 32 个 DCLK 始终为 0 |
| 3 | 1 | 0 | 1 | 32 个 DCLK 内采到 0、1，并出现翻转 |
| 4 | 0 | 0 | 0 | 32 个 DCLK 始终为 0 |
| 5 | 1 | 0 | 1 | 32 个 DCLK 内采到 0、1，并出现翻转 |
| 6 | 1 | 1 | 0 | 32 个 DCLK 始终为 0 |
| 7 | 0 | 1 | 1 | 32 个 DCLK 内采到 0、1，并出现翻转 |

覆盖四种真值组合，以及保持 pin 改寄存器、保持寄存器改 pin 的双向使能切换。cfg_frame8 重复帧7，配合基础发送流程收尾，仍只发送8帧图像。

## 4. TEST2 驱动

根据模拟 IO spec，TEST2 才是 TESTO_EN 输入；TEST12 是 EOL_DET_I。TB 原 .TEST2(iodata0) 改为独立 TEST2 wire，由默认0变量连续驱动；TEST12 恢复原固定0连接：

```systemverilog
logic testo_en_drive = 1'b0;
wire TEST2;
assign TEST2 = testo_en_drive;
```

其他 case 默认仍为0。当前公共 send_CTRLF_seq 不是 virtual，因此不改公共发送代码：本 case 在每组 CTRL_F 首个0x00接收写沿设置该组pin，早于目标0x20写入，保持至检查完成及下一组开始。配置索引在0x30密码写入、沿后稳定后生效。

不能仅按 VS_O 切换 pin 而假定配置与视频帧同号；配置和 pin 的组号须跟随实际发送及接收流程对应。

## 5. 最终检查信号

```text
chip_tb_top.u_HK1V11.u_HK1V11_digital_top.TESTO_EN_I
chip_tb_top.u_HK1V11.u_HK1V11_digital_top.TESTO_EN_L
chip_tb_top.u_HK1V11.u_HK1V11_digital_top.TESTO_EN_R
chip_tb_top.u_HK1V11.u_HK1V11_digital_top.TESTO_O2
```

- TESTO_EN_I 用于确认 TEST2 pin 输入实际传到数字侧。
- TESTO_EN_L/R 直接与当前组固定期望比较。
- TESTO_O2 用于检查测试数据真正开启或关闭，只观察这一路。
- LC_CPUWR 的实际 TESTO_EN_OPT/R_TESTO_SEL 用于确认配置生效；I_POFF_MODE 用于确认测试前提，不能直接取内部 OE 当作使能期望。

数字侧关闭时 TESTO_O2 应为 0；外部 TESTO2 PAD 关闭后的高阻行为由 PAD 模型决定，不以数字数据为0代替高阻检查。本 case 主检查数字顶层端口。

## 6. 采样与精简 checker

使用一个配置/检查流程、一张固定八组表、八组完成标志及少量窗口状态，不引入通用 scoreboard。

1. 配置接收跟随实际 CTRL_F 0x20 写入。该地址使用 LC_CPUWR.ADDR32_F_TEST、WCK1_A、DATA_F_TEST；0x20 与0x1F位于同一 CHPI beat，不能顺序等待两次写沿。
2. 写沿前捕获 payload，检查0x20期望字节为 OPT 左移6位，即0x00或0x40；沿后等待1ns核对有效寄存器字段、数字侧实际pin、解锁和正常非省电条件。不能在写沿直接读旧配置。
3. 首组 TEST_PRTCT 在0x20之后才写入时，等待同组密码写入并确认解锁，再开启检查窗口；不将未解锁默认值作为正式结果。实现前核对配置发送顺序。
4. 相关配置和pin稳定后，逐 DCLK 上升沿等待1ns采样，连续检查32个样本；每个样本比较TESTO_EN_L/R与固定期望，并拒绝X/Z。
5. 使能为0时，32个TESTO_O2样本均须严格等于0。使能为1时，用 saw_zero、saw_one、toggle_seen 三个标志确认采到0、1及至少一次翻转；任一X/Z报错。不比较精确分频周期，不遍历四路数据。
6. pin或配置切换、复位、省电状态打断窗口时，该窗口不计完成。组配置保持期间重新选择完整窗口；若该组结束仍无32个有效样本，最终报缺失，不能跳过后通过。
7. 每组记录一次完成日志，失败打印组号、pin/OPT、实际/期望OE、TESTO_O2和样本序号。发送收尾后报告八组覆盖并正常释放objection，保留一个总超时。

## 7. 文件规划与通过条件

已生成 t_8b1lane_TESTO_EN_OPT.sv、testo_en_opt_checker.sv、cfg_frame0～8.txt、user_def.sv、test_lib.sv、test.f、waves_dumper.sv，提供内嵌完整模板的独立Python3.9安装脚本，并登记regression/testname.f。脚本同步安装TEST2最小驱动改动，支持根目录或tests下运行及--dv-top。

通过条件：

- 四种pin/OPT组合均有有效检查，八组均完成32个连续样本。
- 两个最终OE端口在全部样本中符合异或真值表。
- 开启时TESTO_O2有0/1及翻转，关闭时始终为0。
- 无X/Z、缺失组或静默跳过；通用checker无错误，仿真正常结束。

已实现case、精简checker、9份cfg和独立Python3.9安装脚本，脚本包含最小TEST2驱动改动及回归登记。本地进行Python语法、配置、安装和采样规则静态核对；完整UVM/DUT编译仿真待服务器执行。

## 8. 依据

- agents/isprx_env/register_config.txt:74～75：0x20[6] TESTO_EN_OPT、[5:0] R_TESTO_SEL。
- cmodel/test/HV2A31/HK1V11_digital_top/seperated_code/LC_CPUWR.v:403～405：字段受LSI_PRTECT保护；1495行起为0x20写入逻辑。
- 同目录LINK_IO_CTRL.v:118：TESTO_EN与R_TESTO_EN_OPT异或；LC_MONBLOCK.v:99、RECK0分频及323～328行：监视使能、默认组和bit1选择。
- LINK_MISC.v:45、56：正常模式OE传递及关闭时数据清零；BUFFER_O.v:247～248：两路OE直连分发。
- 只读顶层参考C:/Users/xiapeng2/Desktop/HK1V11/HDL/TOP/HK1V11_digital_top.v:417～419、581～583：数字顶层输入、两路OE及TESTO数据连接。
- HK1V11_IP_Spec_IO_20261009.xlsx 的 DATA_IO!B9:J9：TEST2 → TESTO_EN_I；DATA_IO!B19:J19：TEST12 → EOL_DET_I；PAD_IO!C17:F17 同时确认TEST2功能。
- tb/chip_tb_top.sv：TEST2新增wire、默认0变量驱动及所有 .TEST2(TEST2) 实例连接；TEST12恢复固定0。

## 9. 引脚更正

原实现误驱动TEST12，导致TEST2仍接iodata0、数字侧TESTO_EN_I保持0。依据模拟IO规格，现改驱动TEST2；异或真值表和OE/TESTO_O2检查规则不变。此项修复仍需服务器复跑验证。
