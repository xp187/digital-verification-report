# PWRC_TSEL 验证计划

## 1. 验证目标

参考 `t_8b1lane_PWRC_TA_TB` 的发送、配置监视和时段采样流程，验证 CHIP_SEL=1 时 `PWRC_TSEL` 对 A/B 时段计时单位的选择：

- TSEL=0：1T=1 packet。
- TSEL=1：1T=4 packets。
- 相同 TA/TB 配置下，TSEL=1 的 A、B 持续时间应分别为 TSEL=0 的四倍。
- 切换计时倍率后，A→B→C 顺序及最终 P/N 控制码仍正确。

目标字段为 `0x20[7] PWRC_TSEL`。更新后的 `PWRC_TA/TB` 规格为 00/01/10/11 = 10/24/40/54 packet。TSEL=0 时为 10/24/40/54 packet；TSEL=1 时每档放大 4 倍，为 40/96/160/216 packet。本 case 对相同 TA/TB 设置严格检查 A、B 宽度各自四倍；绝对宽度由 `t_8b1lane_PWRC_TA_TB` case 按 spec 检查。

## 2. 固定条件

- 使用现有 8-bit、单 lane、12 ports、3840×16、8 帧传输，CHIP_SEL=1。
- PORSD=1；TEST_PRTCT=0x72、CTRLF_CHECKSUM=0101，关闭三帧校验保护等待。
- VPS_EN=00，选择完整处于 R_BKDU=0 的正常输出周期。
- PA=NA=00、PB=NB=01、P=N=11，因此 A/B/C 的 P、N 两路期望分别为 010/010、100/100、111/111。
- 开启 data_merge、digital、analog checker，关闭 chopper checker。
- 复用已有基础 pattern，不生成 PPM，不增加 ctrl_l_line_cfg.txt。

## 3. 八帧激励

每相邻两帧保持 TA/TB 相同，只改变 TSEL。

| 配置组/帧 | TSEL | TA | TB | 检查目的 |
| ---: | :---: | :---: | :---: | --- |
| 0 | 0 | 00 | 11 | 第一组 A/B 基准宽度 |
| 1 | 1 | 00 | 11 | A 最短、B 最长档的四倍关系 |
| 2 | 0 | 01 | 10 | 第二组基准，覆盖 1→0 恢复 |
| 3 | 1 | 01 | 10 | 第二组 A/B 四倍关系 |
| 4 | 0 | 10 | 01 | 第三组基准，覆盖 1→0 恢复 |
| 5 | 1 | 10 | 01 | 第三组 A/B 四倍关系 |
| 6 | 0 | 11 | 00 | 第四组基准，覆盖 1→0 恢复 |
| 7 | 1 | 11 | 00 | A 最长、B 最短档的四倍关系 |

cfg_frame0.txt～cfg_frame7.txt 对应上表；cfg_frame8.txt 重复最后一组，供基础发送流程收尾使用，仍只发送 8 帧图像。

两种 TSEL 下，TA/TB 都覆盖 00/01/10/11。长 A 配短 B、短 A 配长 B，避免同时配置最长 A+B；实现时仍须核对最大倍率下正常行周期足够容纳完整 A/B/C，不通过无依据增大 HFP 规避周期不足。

## 4. 观察信号和采样时机

最终检查点：

```text
chip_tb_top.u_HK1V11.u_HK1V11_digital_top.PWRC_SOP_P[2:0]
chip_tb_top.u_HK1V11.u_HK1V11_digital_top.PWRC_SOP_N[2:0]
```

辅助定位使用 digital_top.u_LOGIC_CENTER 下的：

- CENTER1.ANCTL.CLK（连接 DCLK）、STB_NE、PWRC_TIME。
- LINK_LOGIC.LINK_CONFIG_CTRL.LC_CPUWR 的 CTRL_F 地址译码、WCK1_A、DATA_D。
- LC_REG_MAPPING 的实际 TSEL/TA/TB、P/N 及 A/B 配置、R_BKDU、R_PORSD。

PWRC_TIME=01/10/00 分别定位 A/B/C；期望控制码来自固定配置，不从实际输出反算。内部计数器或阈值不作为宽度倍率的期望来源。

1. 配置按 CTRL_F 实际接收推进，不能只按 VS_O 视频帧计数切换期望。等待同组 0x0A、0x1F、0x20 等相关配置全部写入并生效后，再选完整周期。
2. 写入沿前捕获并检查 payload；等待 1ns 后核对已生效配置，避免在写入沿读旧值。0x1F 与 0x20 位于同一 CHPI beat：同一 WCK1_A 沿分别采 DATA_D 与 DATA_F_TEST，不能顺序等待两次写沿。服务器仍需确认触发器延迟。
3. 计时监视沿后等待 2ps 读取稳定状态，与 PWRC_TA_TB checker 使用相同的采样点。
4. STB_NE 标记候选起点；帧交接时若 PWRC_TIME 尚未进入 A（01），继续等待该阶段出现后才开始测宽。随后记录 A→B、B→C 时钟序号，A 宽度为 A 起点至 A→B，B 宽度为 A→B 至 B→C。
5. 最终输出寄存器消费沿前时段，因此 DCLK 沿前保存 PWRC_TIME，沿后等待 2ps 再比较 PWRC_SOP_P/N。同步清零起点的旧时段不当作新周期的 A 段输出。

## 5. 精简 checker 规划

使用一个配置监视 task、一个周期检查 task、一个最终 report，不引入通用 scoreboard 或复杂恢复框架。

- 一张固定八组配置表。
- 四组 TSEL=0 的 A/B 基准宽度，单位为 DCLK 数。
- 八组完成标志，保证每组至少完成一次正常 A→B→C 检查。
- 一个小比较函数复用 P/N 端口检查；只打印失败信息和最终覆盖情况。

每组先取得一个完整有效周期：偶数组保存 A/B 基准，下一奇数组检查：

```text
measured_A_1 == 4 * measured_A_0
measured_B_1 == 4 * measured_B_0
```

使用整数 DCLK 数严格比较，不加宽泛容差。若对应基准缺失，报告缺少基准，不使用默认零值判断通过。

同时检查 A→B→C 顺序和三段最终 P/N 控制码。相关配置更新、复位或 BKDU 切换打断周期时，重新选择完整正常周期；若配置保持不变且下一次 STB_NE 已到而 A/B 仍未结束，报告周期不完整。缺失阶段或全部跳过均不能通过。

错误信息包含配置组、TSEL/TA/TB、阶段、实测/基准/四倍期望宽度，或最终端口实际码与期望码。

## 6. 文件规划

已实现：t_8b1lane_PWRC_TSEL.sv、pwrc_tsel_checker.sv、cfg_frame0～8.txt、user_def.sv、test_lib.sv、test.f、waves_dumper.sv，以及独立 Python 3.9 安装脚本；由安装脚本登记 regression/testname.f。

主流程先启动监视再发送，发送结束后检查八组完成情况并释放 objection；保留一个总超时，不依赖第九帧视频退出。安装脚本应包含完整文件模板，支持放在 DV 根目录或 tests 下运行，并可用 --dv-top 指定路径。

## 7. 通过条件与当前状态

- 两种 TSEL 下 TA/TB 四档均有完整周期。
- 四组配对的 A、B 宽度分别严格满足四倍关系。
- 每组 A/B/C 顺序正确，最终 SOP 控制码正确，TSEL 切换后新配置生效。
- 无配置缺失、无完整周期缺失；通用 checker 无错误，仿真正常收尾。

已实现 case、精简 checker、9 份 cfg 和独立 Python 3.9 安装脚本；本地进行 Python 语法、配置、信号引用及安装一致性检查，完整 UVM/DUT 编译仿真待服务器执行。本计划不覆盖 CHIP_SEL=0、checksum 保护流程、VPS 功能或模拟电流/功耗数值。

## 8. 依据

- 用户提供的 PWRC_TSEL 寄存器截图：0 为 1 packet/T，1 为 4 packets/T。
- 用户更新的 PWRC_TA/TB 规格截图：00/01/10/11 对应 10/24/40/54 packet。
- agents/isprx_env/register_config.txt:73：0x20[7]、默认 0。
- cmodel/test/HV2A31/HK1V11_digital_top/seperated_code/ANCTL.v:237：CNT >> (2*PWRC_TSEL)；239～240：A/B 阶段边界。
- tests/t_8b1lane_PWRC_TA_TB/VERIFICATION_PLAN.md 和 pwrc_ta_tb_checker.sv：已有配置接收、同步计时及检查流程。参考其组织方式，采样稳定时间按本计划核对。
