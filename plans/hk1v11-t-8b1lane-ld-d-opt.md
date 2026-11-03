# LD_D_OPT 行加载时序验证计划

## 1. 目标与模式

验证 `0x2F[7] LD_D_OPT`：960/720 channel 下，0使能6 packet延迟，1关闭延迟；6 packet对应3个DCLK。当前case为单lane 8B/10B短编码，要求 `SP=1、reg_eol=0`，不切换为413b/420b。

短编码下，LD_D_OPT改变DATA_NUM，从而改变K1之后STB_A出现的时间；`TP_DLY_CNT0_START`自身也随DATA_NUM移动，不能用它作为开关延迟的固定比较起点。主判据改为 **K1_FIND到STB_A上升沿的DCLK间隔差**。短路径的TP_DLY_LOAD来自TPD_CLIP，固定LD_R=5时所有阶段均为10；LONG_TP_DLY_LOAD只作诊断，不是当前路径期望。

## 2. 激励

通过正常CHPI发送10帧恒定像素，每帧VACT=16、VBP=4、VFP=5；cfg_frame0为初始配置，最后活动行末发送下一份CTRL_F，cfg_frame10重复末档。固定CHIP_SEL=0、LD_R=5、LD_W=22、LD_F=0、AVE_MODE=0、TEST_PRTCT=0x72、CTRLF_CHECKSUM=0101（关闭保护），TP提前下降及强制Hi-Z关闭。无I2C，无PPM。

| 阶段/帧 | CH_SEL | DPLC_MODE | LD_D_OPT | 预期DATA_NUM | 主判据 |
|---|---|---|---|---|---|
| 0/1/2 | 001（960） | 0 | 0/1/0 | 488/485/488 | 0减1为3 DCLK，2恢复0 |
| 3/4/5 | 011（720） | 0 | 0/1/0 | 368/365/368 | 3减4为3 DCLK，5恢复3 |
| 6/7 | 000（966） | 0 | 0/1 | 488/488 | 差值0 |
| 8/9 | 001（960） | 1 | 0/1 | 245/245 | 当前DPLC ECO下差值0 |

## 3. Checker

- 用实际 `{R_CH_SEL,R_DPLC_MODE,R_LD_D_OPT}` 按上表顺序推进阶段；恢复档与之前档位相同，也必须进入新阶段，不能全表首匹配。
- 以K1_FIND开始计数，到STB_A上升沿记录间隔。每次配置切换丢弃跨配置的未完成行，再跳过新档第一条K1行；后续按到达顺序配对，不声称已经按活动行号筛选。
- 每档至少3个有效样本。960/720差值固定为3，恢复档与基线相同；966/DPLC差值固定为0，不从DUT计数生成expected。
- 辅助检查SP=1、reg_eol=0、DATA_NUM表及TP_DLY_LOAD=10，失败样本不计通过数；LSI_PRTECT、R_LD_D取反及LD_R检查保留，并核对0x07[3:0]=5。STB缺失、X/Z、同档脉宽变化或开关档脉宽不一致报错。
- DPLC阶段依赖ECO_for_LD_D_DPLC_enable_20241230；缺宏报环境错误，不能PASS。功能、辅助或环境错误任一非零均不打印PASS。
- data_merge、digital、analog、chopper公共checker关闭；当前不检查SIM_OUT数值。

## 4. 验证与运行

以当前CHPI_SD_CTRL.v核对K1装载DATA_NUM、短路径TPD_CLIP=2*LD_R、STB时序及DPLC门控。须区分本地RTL模块测试与完整服务器CHPI/UVM仿真；本机没有VCS/UVM，完整编译及仿真仍需服务器确认。

安装：`python3 install_t_8b1lane_LD_D_OPT_CHECKSUM_20261022.py --dv-top /path/to/top`，再运行 `t_8b1lane_LD_D_OPT`。默认也可将脚本放DV根目录或tests目录执行。未修改公共TB、driver或RTL。

修正记录：此前11份cfg均漏配CTRLF_CHECKSUM，环境默认0000会打开checksum保护，使CH_SEL/DPLC_MODE与直接写入的LD_D_OPT不能按逐帧表同时生效。现全部显式写0101。该问题与短路径测量起点、恢复档识别分别修复；实际CHPI运行待服务器重跑。
