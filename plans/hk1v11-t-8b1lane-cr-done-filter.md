# cr_done_filter 数字验证计划

## 1. 范围与配置

独立 case 为 `t_8b1lane_cr_done_filter`，只通过真实 CHPI CTRL_F 写寄存器。禁止 I2C 事务、I2C 使能键和寄存器后门写入。不修改既有 filter0、公共环境或 RTL，不发送图像/PPM。

目标字段为 `0x24[7:6]`，默认 `00`。同地址低六位 `reg_cr_done_cnt` 保持默认 `010101`。每份配置仅包含 CH_SEL、TEST_PRTCT、CTRLF_CHECKSUM 和 cr_done_filter；密码使受保护字段生效，checksum=5沿用现有单次配置生效方式。

| 配置 | symbol 数 | 连续通过 DCLK 数 N |
|---|---:|---:|
| `00` | 16 | 8 |
| `01` | 8 | 4 |
| `10` | 32 | 16 |
| `11` | 64 | 32 |

门限及下述采样/保持行为依据用户指定的当前 RTL。后续完整 spec 若不同，记录差异并按确认后的 spec 修订。

## 2. 激励与发送时序

七次真实 CHPI 配置依次为 `00/01/10/11/01/11/01`，通过 mailbox 请求和完成应答串行配合。每次 CTRL_F 后发送完整 guard，排空最后一个 driver response 后才应答，保证 checker 不会在发送未结束时 force 输入。

检查完一档后先释放数据 force，再允许 sender 发送下一组 CHPI；普通配置同时释放锁定 force，发送 guard 后若 LOCK 低则走现有训练恢复。首次配置前不等待尚未启动的 DCLK，避免训练与请求互等。

probe 在 `test_lib.sv` 内显式实例化为 `chip_tb_top.cf_probe`，提供可重复开启/释放且相互独立的数据和锁定控制。用静态变量驱动 INDATA、INDATA_D1、LOCK_FREQ_DEB，DCLK保持真实运行。

人工失锁时临时保持 `N_RST_NLOCK_NORMAL=1`，防止 CHPI 已写入的目标字段和密码被清除；不 force 存储寄存器、配置字段、计数器或结果。计数阶段临时保持 `N_RST_PHY=1` 隔离复位反馈，但错误及请求输出可观察；最后释放该隔离检查真实反馈。正常结束和超时均 release 所有控制。

## 3. DATA_PASS 与检查点

DATA_PASS 要求 `INDATA[9:0]`、`INDATA[19:10]`、`INDATA_D1[9:0]` 三个 10-bit 值相等，不是多项式 CRC。

匹配模式均取 `10'h155`；失配分别只改变当前低十位或前拍低十位。下降沿改变激励，上升沿 NBA 完成后检查。expected 来自固定配置表和预定输入。

检查 CDR_CRC_DET 的 LINK_ST_OE/CDR_CRC_DET_ERR，最终 LOGIC_CENTER 的 LOCK_PAD_L_O/LOCK_PAD_R_O，以及 CHPI_FAULT_FLAG 到 PHY_RST_REQ_WD_UTC 的错误请求链。

## 4. 验证项目

1. 复位检查 0x24 为 0x15、字段为00、LOCK为0。四档真实CHPI写入后检查字段到达CDR模块、密码有效及低六位保持。
2. 四档分别检查第1至N−1个通过周期LOCK=0，第N个通过周期LOCK=1；匹配时错误始终0。
3. 通过后失配：LOCK保持1且错误0；再人工失锁，检查LOCK清零，恢复后重新连续通过N次。
4. 每档在N−1次通过后分别插入两类失配，检查错误1和LOCK0；恢复后必须重新连续通过N次。
5. 双向01→11及11→01：先让旧档通过，释放数据force，保持LOCK_FREQ_DEB=1，通过真实CHPI写新值。检查实际字段已改变、采样寄存器仍等于预定旧值、LOCK保持1；随后LOCK_FREQ_DEB经0→1，再按新档完整计数。这直接检查配置保持，不再尝试在长CTRL_F事务完成前保留N−1计数。读取采样寄存器仅用于直接比较，不能用其产生expected。
6. 最后恢复真实PHY复位反馈，单独触发一次错误，检查CDR_CRC_DET_RST_REQ传至PHY_RST_REQ_WD_UTC；该项与计数测试分开，避免复位中断计数。

## 5. 完成与验证状态

checker 保留一个门限表、计数检查任务和少量直接比较。四档、两种失配、双向配置采样及真实错误请求全部完成且无错误才通过。总超时2ms，打印当前阶段及完成位；FRAME_NUM=1仅兼容公共静态数组，公共数据checker关闭。

参考目录：`E:\projects\HK1V11_top_1012\cmodel\test\HV2A31\HK1V11_digital_top\seperated_code`。主要文件为 CDR_CRC_DET.v、LC_CPUWR.v、BUFFER_O.v、CHPI_FAULT_FLAG.v、LINK_FAULT_CTRL.v、RSTNGEN.v。

已实现CHPI-only代码；本地静态/模块检查与完整服务器结果必须区分。实际CHPI重锁、配置完成握手、端口force共享网行为及VCS/UVM全芯片仿真仍待服务器验证。

本地结果：实际checker任务/probe配合实际CDR_CRC_DET和CHPI_FAULT_FLAG运行通过四档、双向切换和错误请求；配置由“已解码写入”夹具替代，没有模拟CHPI接收器。门限、清零、实时采样和通过后错误四类突变均被拒绝。Python安装/静态/response平衡检查另行通过，不能据此声称实际总线仿真通过。
