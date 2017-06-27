#! /usr/bin/env python2

from pcs import PcapConnector
from socket import inet_ntop, IPPROTO_TCP, AF_INET
import argparse
import struct


def main():
    parser = argparse.ArgumentParser(
                        description='Process pcap files into list of 4-tuples'
                      )
    parser.add_argument('file', nargs='+',
                        help='.pcap file(s) for processing')

    args = parser.parse_args()
    tuples = set()
    for file in args.file:
        done = False
        pcs_file = PcapConnector(file)
        while not done:
            try:
                packet = pcs_file.readpkt()
            except:
                done = True

            if(packet.type != 0x800):
                continue

            ip = packet.data
            if(ip.protocol != IPPROTO_TCP):
                continue

            tcp = ip.data
            src = inet_ntop(AF_INET, struct.pack('!L', ip.src))
            dest = inet_ntop(AF_INET, struct.pack('!L', ip.dst))
            tuples.add((src, tcp.sport, dest, tcp.dport))

    print("src, src_port, dest, dest_port")
    for tuple in tuples:
        s, sp, d, dp = tuple
        print("{}, {}, {}, {}".format(s, sp, d, dp))


if __name__ == "__main__":
    main()
